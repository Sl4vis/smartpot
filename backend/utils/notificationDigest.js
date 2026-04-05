const { buildDeviceStatus } = require('./deviceStatus');

const ISSUE_PRIORITY = {
  watering_needed: 10,
  low_moisture: 10,
  low_light: 20,
  high_temperature: 20,
  device_offline: 50,
  no_data: 55,
  unread_alerts: 60
};

function buildPlantIssues(overview = []) {
  return overview
    .map((item) => {
      const plant = item?.plant || {};
      const reading = item?.latest_reading || null;
      const analysis = item?.latest_analysis || null;
      const status = item?.device_status || buildDeviceStatus(reading);
      const issues = [];

      if (reading && plant.min_soil_moisture != null && Number(reading.soil_moisture) < Number(plant.min_soil_moisture)) {
        issues.push({
          type: 'low_moisture',
          priority: ISSUE_PRIORITY.low_moisture,
          text: `treba poliať (${Math.round(Number(reading.soil_moisture))}% pôda)`
        });
      }

      if (reading && plant.min_light != null && Number(reading.light_lux) < Number(plant.min_light)) {
        issues.push({
          type: 'low_light',
          priority: ISSUE_PRIORITY.low_light,
          text: `málo svetla (${Math.round(Number(reading.light_lux))} lux)`
        });
      }

      if (reading && plant.max_temperature != null && Number(reading.temperature) > Number(plant.max_temperature)) {
        issues.push({
          type: 'high_temperature',
          priority: ISSUE_PRIORITY.high_temperature,
          text: `príliš teplo (${Math.round(Number(reading.temperature))} °C)`
        });
      }

      if (analysis?.watering_needed && !issues.some(issue => issue.type === 'low_moisture' || issue.type === 'watering_needed')) {
        issues.push({
          type: 'watering_needed',
          priority: ISSUE_PRIORITY.watering_needed,
          text: 'AI odporúča polievanie'
        });
      }

      if (status.is_no_data) {
        issues.push({
          type: 'no_data',
          priority: ISSUE_PRIORITY.no_data,
          text: 'zariadenie ešte neposlalo dáta'
        });
      } else if (status.is_offline) {
        const minutes = status.minutes_since_last_sync;
        issues.push({
          type: 'device_offline',
          priority: ISSUE_PRIORITY.device_offline,
          text: `zariadenie je offline ${formatRelativeMinutes(minutes)}`
        });
      }

      if ((item?.unread_alerts || 0) > 0 && issues.length === 0) {
        issues.push({
          type: 'unread_alerts',
          priority: ISSUE_PRIORITY.unread_alerts,
          text: `${item.unread_alerts} nových upozornení`
        });
      }

      issues.sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text, 'sk'));

      return {
        plantId: plant.id,
        plantName: plant.name || 'Rastlina',
        deviceId: plant.device_id || item?.device_id || null,
        issues,
        status
      };
    })
    .filter(entry => entry.issues.length > 0);
}

function summarizeIssuesForPush(entry) {
  const actionable = entry.issues.filter(issue => issue.type !== 'device_offline' && issue.type !== 'no_data');
  const selected = (actionable.length > 0 ? actionable : entry.issues)
    .slice(0, 2)
    .map(issue => capitalize(issue.text));

  return selected.join(', ');
}

function buildPushPayload(overview = []) {
  const plantsWithIssues = buildPlantIssues(overview);

  if (plantsWithIssues.length === 0) {
    return null;
  }

  const title = plantsWithIssues.length === 1
    ? `${plantsWithIssues[0].plantName} potrebuje pozornosť`
    : `${plantsWithIssues.length} rastliny potrebujú pozornosť`;

  const lines = plantsWithIssues
    .slice(0, 3)
    .map((entry) => {
      const summary = summarizeIssuesForPush(entry);
      return plantsWithIssues.length === 1 ? summary : `${entry.plantName}: ${summary}`;
    });

  const moreCount = plantsWithIssues.length - lines.length;
  const body = moreCount > 0
    ? `${lines.join('\n')}\n+ ďalších ${moreCount}`
    : lines.join('\n');

  return {
    title,
    body,
    tag: plantsWithIssues.length === 1
      ? `smartpot-plant-${plantsWithIssues[0].plantId}`
      : 'smartpot-attention-summary',
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-badge.png',
    data: {
      url: '/alerts',
      plants: plantsWithIssues.map(item => ({
        id: item.plantId,
        name: item.plantName,
        issues: item.issues.map(issue => issue.text),
        device_id: item.deviceId
      })),
      created_at: new Date().toISOString(),
      type: 'attention-summary'
    }
  };
}

function buildDeviceStatusChangePayload({ deviceId, plantName, status }) {
  const normalizedStatus = status === 'online' ? 'online' : 'offline';

  return {
    title: `Zariadenie ${deviceId || 'SmartPot'} je ${normalizedStatus === 'online' ? 'online' : 'offline'}`,
    body: normalizedStatus === 'online'
      ? `${plantName || 'Rastlina'} znovu posiela dáta.`
      : `${plantName || 'Rastlina'} je momentálne nedostupná.`,
    tag: `smartpot-device-${deviceId || 'unknown'}-${normalizedStatus}`,
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-badge.png',
    data: {
      url: '/alerts',
      device_id: deviceId,
      plant_name: plantName || null,
      created_at: new Date().toISOString(),
      type: normalizedStatus === 'online' ? 'device-online' : 'device-offline'
    }
  };
}

function buildTestPushPayload() {
  return {
    title: 'Test notifikácie',
    body: 'Push notifikácie sú nastavené správne. Odteraz môžu prísť upozornenia o rastlinách a stave zariadení.',
    tag: 'smartpot-test-push',
    renotify: false,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-badge.png',
    data: {
      url: '/alerts',
      created_at: new Date().toISOString(),
      type: 'test'
    }
  };
}

function formatRelativeMinutes(minutes) {
  if (minutes == null) return 'neznámo dlho';
  if (minutes < 1) return 'práve teraz';
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  return `pred ${Math.floor(hours / 24)} d`;
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

module.exports = {
  buildPlantIssues,
  buildPushPayload,
  buildDeviceStatusChangePayload,
  buildTestPushPayload
};
