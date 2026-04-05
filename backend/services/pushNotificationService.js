const webpush = require('web-push');
const { supabase } = require('../models/supabase');
const { buildDeviceStatus } = require('../utils/deviceStatus');
const {
  buildPushPayload,
  buildTestPushPayload,
  buildDeviceStatusChangePayload
} = require('../utils/notificationDigest');

const DIGEST_INTERVAL_MINUTES = Number(process.env.PUSH_DIGEST_INTERVAL_MINUTES || 60);
const SCHEDULER_INTERVAL_MINUTES = Number(process.env.PUSH_SCHEDULER_INTERVAL_MINUTES || 10);
const PUSH_SUBJECT = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@example.com';
const VAPID_PUBLIC_KEY = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || null;
const VAPID_PRIVATE_KEY = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || null;

let schedulerStarted = false;
let digestRunning = false;

function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(PUSH_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function getPushConfig() {
  return {
    push_available: isPushConfigured(),
    vapid_public_key: VAPID_PUBLIC_KEY,
    digest_interval_minutes: DIGEST_INTERVAL_MINUTES,
    scheduler_interval_minutes: SCHEDULER_INTERVAL_MINUTES
  };
}

async function savePushSubscription({ subscription, userAgent, platform }) {
  if (!subscription?.endpoint) {
    throw new Error('Push subscription neobsahuje endpoint');
  }

  const now = new Date().toISOString();
  const payload = {
    endpoint: subscription.endpoint,
    keys_p256dh: subscription.keys?.p256dh || null,
    keys_auth: subscription.keys?.auth || null,
    subscription_json: subscription,
    user_agent: userAgent || null,
    platform: platform || null,
    enabled: true,
    last_seen_at: now,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function disablePushSubscription(endpoint) {
  if (!endpoint) return null;

  const { data, error } = await supabase
    .from('push_subscriptions')
    .update({
      enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq('endpoint', endpoint)
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function sendTestPush(subscription) {
  return sendPushToSubscription(subscription, buildTestPushPayload());
}

async function sendPushToSubscription(subscription, payload) {
  if (!isPushConfigured()) {
    throw new Error('Web Push nie je nakonfigurovaný. Chýbajú VAPID kľúče.');
  }

  if (!subscription?.endpoint) {
    throw new Error('Chýba push subscription endpoint.');
  }

  const notification = JSON.stringify(payload);
  return webpush.sendNotification(subscription, notification);
}

async function getOverviewForPush() {
  const { data: plants, error: plantError } = await supabase
    .from('plants')
    .select('*')
    .order('created_at', { ascending: false });

  if (plantError) throw plantError;

  return Promise.all(
    (plants || []).map(async (plant) => {
      const { data: latestReading } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', plant.device_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: latestAnalysis } = await supabase
        .from('ai_analyses')
        .select('health_score, status, summary, watering_needed')
        .eq('plant_id', plant.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: alertCount } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', plant.device_id)
        .eq('read', false);

      return {
        plant,
        latest_reading: latestReading || null,
        latest_analysis: latestAnalysis || null,
        unread_alerts: alertCount || 0,
        device_status: buildDeviceStatus(latestReading || null)
      };
    })
  );
}

function isSubscriptionDue(record) {
  if (!record?.enabled) return false;
  if (!record.last_sent_at) return true;

  const elapsedMinutes = (Date.now() - new Date(record.last_sent_at).getTime()) / 60000;
  return elapsedMinutes >= DIGEST_INTERVAL_MINUTES;
}

async function sendToSubscriptionRecords(records, payload, { updateDigestTimestamp = false } = {}) {
  if (!isPushConfigured() || !payload || !records?.length) return 0;

  const now = new Date().toISOString();
  let sentCount = 0;

  for (const record of records) {
    try {
      await sendPushToSubscription(record.subscription_json, payload);
      sentCount += 1;

      const update = {
        last_successful_send_at: now,
        last_error: null,
        updated_at: now
      };

      if (updateDigestTimestamp) {
        update.last_sent_at = now;
      }

      await supabase
        .from('push_subscriptions')
        .update(update)
        .eq('endpoint', record.endpoint);
    } catch (error) {
      const statusCode = error?.statusCode || error?.status || null;
      const update = {
        last_error: error?.body || error?.message || 'Unknown push error',
        updated_at: now
      };

      if (statusCode === 404 || statusCode === 410) {
        update.enabled = false;
      }

      await supabase
        .from('push_subscriptions')
        .update(update)
        .eq('endpoint', record.endpoint);
    }
  }

  return sentCount;
}

async function sendImmediatePushNotification(payload) {
  if (!isPushConfigured() || !payload) return 0;

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true);

  if (error) throw error;
  return sendToSubscriptionRecords(subscriptions || [], payload, { updateDigestTimestamp: false });
}

async function createDeviceStatusAlert({ plant, type, message, severity }) {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      device_id: plant.device_id,
      plant_id: plant.id,
      type,
      message,
      severity
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function checkAndNotifyOfflineTransitions(overview) {
  const offlineEntries = (overview || []).filter(
    (item) => item?.plant?.id && item?.plant?.device_id && item?.latest_reading && item?.device_status?.is_offline
  );

  if (offlineEntries.length === 0) return;

  const plantIds = offlineEntries.map(item => item.plant.id);
  const { data: offlineAlerts, error } = await supabase
    .from('alerts')
    .select('plant_id, created_at')
    .in('plant_id', plantIds)
    .eq('type', 'device_offline')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const latestAlertByPlant = new Map();
  for (const alert of offlineAlerts || []) {
    if (!latestAlertByPlant.has(alert.plant_id)) {
      latestAlertByPlant.set(alert.plant_id, alert);
    }
  }

  for (const entry of offlineEntries) {
    const latestReadingAt = new Date(entry.latest_reading.created_at).getTime();
    const latestOfflineAlert = latestAlertByPlant.get(entry.plant.id);
    const latestOfflineAlertAt = latestOfflineAlert ? new Date(latestOfflineAlert.created_at).getTime() : 0;

    if (latestOfflineAlertAt > latestReadingAt) {
      continue;
    }

    const minutes = entry.device_status.minutes_since_last_sync;
    await createDeviceStatusAlert({
      plant: entry.plant,
      type: 'device_offline',
      message: `Zariadenie ${entry.plant.device_id} je offline ${formatRelativeMinutes(minutes)}.`,
      severity: 'warning'
    });

    await sendImmediatePushNotification(buildDeviceStatusChangePayload({
      deviceId: entry.plant.device_id,
      plantName: entry.plant.name,
      status: 'offline'
    }));
  }
}

async function sendScheduledPushDigests() {
  if (!isPushConfigured() || digestRunning) return;

  digestRunning = true;

  try {
    const overview = await getOverviewForPush();
    await checkAndNotifyOfflineTransitions(overview);

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('enabled', true);

    if (error) throw error;

    const dueSubscriptions = (subscriptions || []).filter(isSubscriptionDue);
    if (dueSubscriptions.length === 0) return;

    const payload = buildPushPayload(overview);
    if (!payload) return;

    await sendToSubscriptionRecords(dueSubscriptions, payload, { updateDigestTimestamp: true });
  } catch (error) {
    console.error('❌ Push digest scheduler chyba:', error.message);
  } finally {
    digestRunning = false;
  }
}

function startPushScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (!isPushConfigured()) {
    console.log('⚠️  Web Push scheduler vypnutý — chýbajú WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY');
    return;
  }

  console.log(`🔔 Web Push scheduler beží — digest každých ~${DIGEST_INTERVAL_MINUTES} minút`);

  setTimeout(() => {
    sendScheduledPushDigests().catch((error) => {
      console.error('❌ Úvodný push digest zlyhal:', error.message);
    });
  }, 30 * 1000);

  setInterval(() => {
    sendScheduledPushDigests().catch((error) => {
      console.error('❌ Periodický push digest zlyhal:', error.message);
    });
  }, SCHEDULER_INTERVAL_MINUTES * 60 * 1000);
}

function formatRelativeMinutes(minutes) {
  if (minutes == null) return 'neznámo dlho';
  if (minutes < 1) return 'práve teraz';
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  return `pred ${Math.floor(hours / 24)} d`;
}

module.exports = {
  DIGEST_INTERVAL_MINUTES,
  getPushConfig,
  isPushConfigured,
  savePushSubscription,
  disablePushSubscription,
  sendTestPush,
  sendScheduledPushDigests,
  sendImmediatePushNotification,
  startPushScheduler
};
