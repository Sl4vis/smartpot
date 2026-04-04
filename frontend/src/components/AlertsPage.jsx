import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Droplets,
  Sun,
  Thermometer,
  Leaf,
  WifiOff,
  Activity,
  CircleHelp,
  BellRing,
  BellOff,
  Send,
  Smartphone,
  Download,
  ShieldCheck
} from 'lucide-react';
import {
  getAlerts,
  getDashboardOverview,
  markAlertRead,
  markAllAlertsRead,
  getNotificationConfig,
  subscribePushNotifications,
  unsubscribePushNotifications,
  sendPushTestNotification
} from '../services/api';
import {
  isNotificationsEnabledByUser,
  setNotificationsEnabledByUser,
  requestNotificationPermission,
  getNotificationPermission,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  isNotificationApiSupported,
  isPushSupported,
  requiresInstalledAppForPush,
  getPushSupportHint,
  isStandaloneMode,
  isIosDevice
} from '../services/browserNotifications';
import { getDeviceStatus } from '../utils/deviceStatus';

const DEMO_ALERTS = [
  {
    id: '1',
    type: 'low_moisture',
    message: 'Nízka vlhkosť pôdy: 19% (minimum: 20%)',
    severity: 'warning',
    read: false,
    created_at: new Date(Date.now() - 40 * 60000).toISOString(),
    device_id: 'esp32-001',
    plant_id: 'plant-1',
    plant: { id: 'plant-1', name: 'Kaktus', species: 'Izba', location: 'Obývačka', device_id: 'esp32-001' }
  },
  {
    id: '2',
    type: 'low_light',
    message: 'Málo svetla: 31.7 lux (minimum: 5000 lux)',
    severity: 'info',
    read: false,
    created_at: new Date(Date.now() - 20 * 60000).toISOString(),
    device_id: 'esp32-001',
    plant_id: 'plant-1',
    plant: { id: 'plant-1', name: 'Kaktus', species: 'Izba', location: 'Obývačka', device_id: 'esp32-001' }
  },
  {
    id: '3',
    type: 'high_temperature',
    message: 'Vysoká teplota: 32°C (maximum: 28°C)',
    severity: 'warning',
    read: true,
    created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
    device_id: 'esp32-002',
    plant_id: 'plant-2',
    plant: { id: 'plant-2', name: 'Monstera', species: 'Monstera deliciosa', location: 'Spálňa', device_id: 'esp32-002' }
  }
];

const DEMO_OVERVIEW = [
  {
    plant: { id: 'plant-1', name: 'Kaktus', species: 'Kaktus', location: 'Obývačka', device_id: 'esp32-001', min_soil_moisture: 20, min_light: 500 },
    latest_reading: { soil_moisture: 19, temperature: 24, humidity: 35, light_lux: 32, created_at: new Date(Date.now() - 65 * 60000).toISOString() },
    latest_analysis: { watering_needed: true },
    unread_alerts: 2
  },
  {
    plant: { id: 'plant-2', name: 'Monstera', species: 'Monstera deliciosa', location: 'Spálňa', device_id: 'esp32-002', min_soil_moisture: 40, min_light: 300 },
    latest_reading: { soil_moisture: 48, temperature: 22, humidity: 57, light_lux: 420, created_at: new Date().toISOString() },
    latest_analysis: { watering_needed: false },
    unread_alerts: 0
  },
  {
    plant: { id: 'plant-3', name: 'Fikus', species: 'Ficus', location: 'Kuchyňa', device_id: 'esp32-003', min_soil_moisture: 30, min_light: 300 },
    latest_reading: null,
    latest_analysis: null,
    unread_alerts: 0
  }
];

const icons = {
  low_moisture: Droplets,
  high_temperature: Thermometer,
  low_light: Sun
};

const styles = {
  warning: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-100' },
  critical: { bg: 'bg-red-50', icon: 'text-red-500', border: 'border-red-100' },
  info: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-100' }
};

function getPlantGroupKey(alert) {
  return alert.plant?.id || alert.plant_id || alert.device_id || 'unassigned';
}

function getPlantTitle(alert) {
  if (alert.plant?.name) return alert.plant.name;
  if (alert.plant_id) return 'Rastlina';
  return 'Nepriradené upozornenia';
}

function getPlantSubtitle(alert) {
  const pieces = [
    alert.plant?.species,
    alert.plant?.location,
    alert.device_id
  ].filter(Boolean);

  return pieces.length ? pieces.join(' · ') : 'Bez detailu rastliny';
}

function sortGroups(a, b) {
  if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
  return new Date(b.latestAt) - new Date(a.latestAt);
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(isNotificationsEnabledByUser());
  const [permission, setPermission] = useState(getNotificationPermission());
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [pushConfig, setPushConfig] = useState({ push_available: false, vapid_public_key: null, digest_interval_minutes: 60 });
  const [hasPushSubscription, setHasPushSubscription] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [alertsData, overviewData, configData, existingSubscription] = await Promise.all([
          getAlerts().catch(() => null),
          getDashboardOverview().catch(() => null),
          getNotificationConfig().catch(() => null),
          getExistingPushSubscription().catch(() => null)
        ]);

        setAlerts(alertsData?.length ? alertsData : DEMO_ALERTS);
        setOverview(overviewData?.length ? overviewData : DEMO_OVERVIEW);
        if (configData) setPushConfig(configData);
        const hasSubscription = Boolean(existingSubscription);
        setHasPushSubscription(hasSubscription);
        setNotificationsEnabled(isNotificationsEnabledByUser() && hasSubscription);
      } catch {
        setAlerts(DEMO_ALERTS);
        setOverview(DEMO_OVERVIEW);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleMarkRead(id) {
    try {
      await markAlertRead(id);
    } catch {
      // optimistic fallback
    }

    setAlerts(prev => prev.map(alert => (
      alert.id === id ? { ...alert, read: true } : alert
    )));
  }

  async function handleMarkAllRead() {
    if (!alerts.some(alert => !alert.read)) return;

    setMarkingAll(true);
    try {
      await markAllAlertsRead();
    } catch {
      // optimistic fallback
    } finally {
      setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
      setMarkingAll(false);
    }
  }

  async function handleEnableNotifications() {
    if (!pushConfig.push_available || !pushConfig.vapid_public_key) {
      alert('Backend ešte nemá nastavené VAPID kľúče pre web push.');
      return;
    }

    if (requiresInstalledAppForPush()) {
      alert('Na iPhone si najprv pridaj SmartPot na plochu a otvor ho z ikonky. Potom klikni znovu na povolenie upozornení.');
      return;
    }

    if (!isNotificationApiSupported()) {
      alert('Tento prehliadač nepodporuje web notifikácie.');
      return;
    }

    setPermissionBusy(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result.permission);
      if (!result.granted) return;

      const subscription = await subscribeToPush(pushConfig.vapid_public_key);
      const serialized = subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription));
      await subscribePushNotifications(serialized, detectPlatformLabel());

      setNotificationsEnabledByUser(true);
      setNotificationsEnabled(true);
      setHasPushSubscription(true);
    } catch (error) {
      console.error('Enable push notifications failed:', error);
      alert('Nepodarilo sa zapnúť push notifikácie. Skontroluj povolenie v prehliadači a otvorenie cez HTTPS.');
    } finally {
      setPermissionBusy(false);
    }
  }

  async function handleDisableNotifications() {
    try {
      const subscription = await getExistingPushSubscription();
      if (subscription?.endpoint) {
        await unsubscribePushNotifications(subscription.endpoint).catch(() => null);
      }
      await unsubscribeFromPush().catch(() => null);
    } finally {
      setNotificationsEnabledByUser(false);
      setNotificationsEnabled(false);
      setHasPushSubscription(false);
    }
  }

  async function handleSendTestNotification() {
    setSendingTest(true);
    try {
      const subscription = await getExistingPushSubscription();
      if (!subscription) {
        alert('Najprv povoľ upozornenia pre tento prehliadač.');
        return;
      }

      const serialized = subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription));
      await sendPushTestNotification(serialized);
    } catch (error) {
      console.error('Push test notification failed:', error);
      alert('Test push sa nepodarilo odoslať. Skontroluj, či má backend nastavené VAPID kľúče a subscription je stále platný.');
    } finally {
      setSendingTest(false);
    }
  }

  const unread = alerts.filter(alert => !alert.read).length;
  const deviceStatusCards = useMemo(() => {
    return overview.map(item => {
      const status = item.device_status || getDeviceStatus(item.latest_reading);
      const issues = [];

      if (status.isOffline) issues.push('Senzor neposiela nové dáta');
      if (status.isNoData) issues.push('Zariadenie ešte neposlalo žiadne merania');
      if (item.latest_reading && item.plant?.min_soil_moisture != null && Number(item.latest_reading.soil_moisture) < Number(item.plant.min_soil_moisture)) {
        issues.push('Treba poliať');
      }
      if (item.latest_reading && item.plant?.min_light != null && Number(item.latest_reading.light_lux) < Number(item.plant.min_light)) {
        issues.push('Pozor na svetlo');
      }

      return {
        plant: item.plant,
        status,
        issues,
        unreadAlerts: item.unread_alerts || 0
      };
    });
  }, [overview]);

  const groupedAlerts = useMemo(() => {
    const groups = new Map();

    alerts.forEach((alert) => {
      const key = getPlantGroupKey(alert);
      const current = groups.get(key) || {
        id: key,
        title: getPlantTitle(alert),
        subtitle: getPlantSubtitle(alert),
        alerts: [],
        unreadCount: 0,
        latestAt: alert.created_at
      };

      current.alerts.push(alert);
      current.latestAt = new Date(alert.created_at) > new Date(current.latestAt) ? alert.created_at : current.latestAt;
      if (!alert.read) current.unreadCount += 1;

      groups.set(key, current);
    });

    return Array.from(groups.values()).sort(sortGroups);
  }, [alerts]);

  const notificationIssuesCount = deviceStatusCards.filter(card => card.issues.length > 0).length;
  const supportHint = getPushSupportHint();
  const deliveryLabel = notificationsEnabled && hasPushSubscription ? 'Skutočný web push' : 'Vypnuté';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Upozornenia</h1>
          <p className="text-sm text-sage-500 mt-1">
            {unread > 0 ? `${unread} neprečítaných` : 'Všetky upozornenia sú prečítané'}
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={markingAll || unread === 0}
          className="btn-secondary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {markingAll ? <CheckCheck className="w-4 h-4 animate-pulse" /> : <CheckCheck className="w-4 h-4" />}
          Označiť všetky ako prečítané
        </button>
      </div>

      <section className="card p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-green-900">Push notifikácie</h2>
            <p className="text-sm text-sage-500 mt-1">
              Po povolení bude backend posielať približne raz za {pushConfig.digest_interval_minutes || 60} minút súhrn rastlín, ktoré treba poliať, majú málo svetla alebo sú offline.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!notificationsEnabled ? (
              <button onClick={handleEnableNotifications} disabled={permissionBusy || !pushConfig.push_available} className="btn-primary disabled:opacity-50">
                {permissionBusy ? <BellRing className="w-4 h-4 animate-pulse" /> : <BellRing className="w-4 h-4" />}
                Povoliť upozornenia
              </button>
            ) : (
              <button onClick={handleDisableNotifications} className="btn-secondary">
                <BellOff className="w-4 h-4" /> Vypnúť upozornenia
              </button>
            )}

            <button
              onClick={handleSendTestNotification}
              disabled={!notificationsEnabled || permission !== 'granted' || sendingTest}
              className="btn-secondary disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${sendingTest ? 'animate-pulse' : ''}`} />
              Poslať test
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <NotificationInfoCard
            label="Doručovanie"
            value={deliveryLabel}
            hint={notificationsEnabled ? 'Push sa pošle aj keď je web zatvorený, pokiaľ je subscription aktívna.' : 'Zatiaľ sa neposielajú žiadne push notifikácie.'}
            tone={notificationsEnabled ? 'green' : 'slate'}
          />
          <NotificationInfoCard
            label="Backend push"
            value={pushConfig.push_available ? 'Pripravené' : 'Chýba konfigurácia'}
            hint={pushConfig.push_available ? 'Server má VAPID kľúče a vie odoslať push.' : 'Nastav WEB_PUSH_VAPID_PUBLIC_KEY a WEB_PUSH_VAPID_PRIVATE_KEY.'}
            tone={pushConfig.push_available ? 'green' : 'red'}
          />
          <NotificationInfoCard
            label="Povolenie prehliadača"
            value={permissionLabel(permission)}
            hint={permission === 'granted' ? 'Prehliadač môže zobrazovať push notifikácie.' : 'Ak je blokované, povoľ to v nastaveniach prehliadača.'}
            tone={permission === 'granted' ? 'green' : permission === 'denied' ? 'red' : 'amber'}
          />
          <NotificationInfoCard
            label="Rastliny s problémom"
            value={String(notificationIssuesCount)}
            hint="Počíta sa offline stav, bez dát, nízka vlhkosť a málo svetla."
            tone={notificationIssuesCount > 0 ? 'amber' : 'green'}
          />
        </div>

        <div className="rounded-2xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-600 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
            <p>{supportHint}</p>
          </div>
          {isIosDevice() && !isStandaloneMode() && (
            <div className="flex items-start gap-2">
              <Download className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <p>Na iPhone otvor Share menu v Safari alebo Chrome/Edge a zvoľ <strong>Pridať na plochu</strong>. Push sa zapína až v nainštalovanej web appke.</p>
            </div>
          )}
          {!isPushSupported() && (
            <div className="flex items-start gap-2">
              <Smartphone className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <p>Na Androide odporúčam Chrome alebo Edge. Na desktope funguje najspoľahlivejšie Chrome, Edge a Safari.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-green-900">Stav zariadení</h2>
          <p className="text-sm text-sage-500 mt-1">Každá rastlina má vlastný stav senzora a poslednú úspešnú správu z ESP32.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deviceStatusCards.map((card) => (
            <div key={card.plant.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-green-900">{card.plant.name}</h3>
                  <p className="text-xs text-sage-500">{[card.plant.species, card.plant.location, card.plant.device_id].filter(Boolean).join(' · ')}</p>
                </div>
                <DeviceStatusBadge status={card.status} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sage-500">Posledná synchronizácia</span>
                  <span className="font-medium text-green-900">{card.status.isNoData ? '—' : card.status.relativeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sage-500">Posledná správa z ESP32</span>
                  <span className="text-sage-500 text-right">{card.status.absoluteLabel}</span>
                </div>
              </div>

              {card.issues.length > 0 ? (
                <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Treba skontrolovať</p>
                  <ul className="space-y-1">
                    {card.issues.map((issue, index) => (
                      <li key={`${card.plant.id}-${index}`} className="text-xs text-amber-700 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Bez aktuálneho problému
                </div>
              )}

              {card.unreadAlerts > 0 && (
                <div className="mt-2 text-xs text-sage-500">Neprečítané alerty: {card.unreadAlerts}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCheck className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <h2 className="text-lg font-semibold text-green-900 mb-1">Žiadne upozornenia</h2>
          <p className="text-sm text-sage-400">Všetky rastliny sú v poriadku.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAlerts.map((group, index) => (
            <section key={group.id} className={`card p-4 sm:p-5 fade-in delay-${Math.min(index + 1, 4)}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                      <Leaf className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-green-900">{group.title}</h2>
                      <p className="text-sm text-sage-500 truncate">{group.subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${group.unreadCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    <Bell className="w-3.5 h-3.5" />
                    {group.unreadCount > 0 ? `${group.unreadCount} neprečítaných` : 'Všetko prečítané'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {group.alerts.map((alert) => {
                  const Icon = icons[alert.type] || AlertTriangle;
                  const theme = styles[alert.severity] || styles.info;

                  return (
                    <div
                      key={alert.id}
                      className={`rounded-2xl border p-4 flex items-start gap-4 transition-all ${theme.border} ${alert.read ? 'bg-sage-50/60 opacity-70' : 'bg-white shadow-sm'}`}
                    >
                      <div className={`p-2.5 rounded-xl ${theme.bg}`}>
                        <Icon className={`w-4 h-4 ${theme.icon}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {!alert.read && (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold">
                              Nové
                            </span>
                          )}
                          <span className="text-[11px] text-sage-400 font-mono">{alert.device_id}</span>
                        </div>

                        <p className="text-sm text-green-900">{alert.message}</p>
                        <p className="text-xs text-sage-400 mt-1.5">{new Date(alert.created_at).toLocaleString('sk')}</p>
                      </div>

                      {!alert.read && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="p-2 rounded-xl hover:bg-green-50 transition-colors flex-shrink-0"
                          title="Označiť ako prečítané"
                        >
                          <Check className="w-4 h-4 text-sage-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationInfoCard({ label, value, hint, tone = 'slate' }) {
  const tones = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-sage-50 text-sage-600 border-sage-100'
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
      <p className="text-xs mt-2 opacity-80">{hint}</p>
    </div>
  );
}

function DeviceStatusBadge({ status }) {
  if (status.isOnline) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700">
        <Activity className="w-3.5 h-3.5" /> Online
      </span>
    );
  }

  if (status.isOffline) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600">
        <WifiOff className="w-3.5 h-3.5" /> Offline
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sage-50 text-sage-600">
      <CircleHelp className="w-3.5 h-3.5" /> Bez dát
    </span>
  );
}

function permissionLabel(permission) {
  if (permission === 'granted') return 'Povolené';
  if (permission === 'denied') return 'Blokované';
  if (permission === 'unsupported') return 'Nepodporované';
  return 'Čaká sa';
}

function detectPlatformLabel() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'web';
}
