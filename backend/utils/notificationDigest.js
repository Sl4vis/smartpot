const { buildDeviceStatus } = require('./deviceStatus');

function buildPlantIssues(overview = []) {
  return overview
    .map((item) => {
      const plant = item?.plant || {};
      const reading = item?.latest_reading || null;
      const analysis = item?.latest_analysis || null;
      const status = item?.device_status || buildDeviceStatus(reading);
      const issues = [];

      if (status.is_no_data) {
        issues.push('zariadenie ešte neposlalo dáta');
      } else if (status.is_offline) {
        const minutes = status.minutes_since_last_sync;
        issues.push(`zariadenie je offline ${formatRelativeMinutes(minutes)}`);
      }

      if (reading && plant.min_soil_moisture != null && Number(reading.soil_moisture) < Number(plant.min_soil_moisture)) {
        issues.push(`treba poliať (${Math.round(Number(reading.soil_moisture))}% pôda)`);
      }

      if (reading && plant.min_light != null && Number(reading.light_lux) < Number(plant.min_light)) {
        issues.push(`málo svetla (${Math.round(Number(reading.light_lux))} lux)`);
      }

      if (reading && plant.max_temperature != null && Number(reading.temperature) > Number(plant.max_temperature)) {
        issues.push(`príliš teplo (${Math.round(Number(reading.temperature))} °C)`);
      }

      if (analysis?.watering_needed && !issues.some(issue => issue.includes('poliať'))) {
        issues.push('AI odporúča polievanie');
      }

      if ((item?.unread_alerts || 0) > 0 && issues.length === 0) {
        issues.push(`${item.unread_alerts} nových upozornení`);
      }

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

function buildPushPayload(overview = []) {
  const plantsWithIssues = buildPlantIssues(overview);

  if (plantsWithIssues.length === 0) {
    return null;
  }

  const title = plantsWithIssues.length === 1
    ? `SmartPot: ${plantsWithIssues[0].plantName} potrebuje pozornosť`
    : `SmartPot: ${plantsWithIssues.length} rastliny potrebujú pozornosť`;

  const lines = plantsWithIssues
    .slice(0, 3)
    .map(({ plantName, issues }) => `${plantName}: ${issues.slice(0, 2).join(', ')}`);

  const moreCount = plantsWithIssues.length - lines.length;
  const body = moreCount > 0
    ? `${lines.join('\n')}\n+ ďalších ${moreCount}`
    : lines.join('\n');

  return {
    title,
    body,
    tag: 'smartpot-hourly-summary',
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-badge.png',
    data: {
      url: '/alerts',
      plants: plantsWithIssues.map(item => ({
        id: item.plantId,
        name: item.plantName,
        issues: item.issues,
        device_id: item.deviceId
      })),
      created_at: new Date().toISOString(),
      type: 'hourly-digest'
    }
  };
}

function buildTestPushPayload() {
  return {
    title: 'SmartPot: test notifikácie',
    body: 'Push notifikácie sú nastavené správne. Odteraz môže prísť hodinový súhrn o rastlinách.',
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

module.exports = {
  buildPlantIssues,
  buildPushPayload,
  buildTestPushPayload
};
