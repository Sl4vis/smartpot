export const OFFLINE_AFTER_MINUTES = 2;

export function getDeviceStatus(readingOrTimestamp) {
  if (readingOrTimestamp && typeof readingOrTimestamp === 'object' && readingOrTimestamp.status && 'is_online' in readingOrTimestamp) {
    return normalizeBackendStatus(readingOrTimestamp);
  }

  const timestamp = typeof readingOrTimestamp === 'string'
    ? readingOrTimestamp
    : readingOrTimestamp?.created_at || null;

  if (!timestamp) {
    return {
      status: 'no_data',
      label: 'Bez dát',
      isOnline: false,
      isOffline: false,
      isNoData: true,
      stale: true,
      minutesSinceLastSync: null,
      lastSyncAt: null,
      lastSuccessfulMessageAt: null,
      relativeLabel: 'ešte neprišli žiadne dáta',
      compactLabel: 'bez dát',
      absoluteLabel: 'Žiadna správa zo senzora',
      warningMessage: 'ESP32 ešte neposlal žiadne meranie.'
    };
  }

  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  const isOffline = minutes >= OFFLINE_AFTER_MINUTES;

  return {
    status: isOffline ? 'offline' : 'online',
    label: isOffline ? 'Offline' : 'Online',
    isOnline: !isOffline,
    isOffline,
    isNoData: false,
    stale: isOffline,
    minutesSinceLastSync: minutes,
    lastSyncAt: timestamp,
    lastSuccessfulMessageAt: timestamp,
    relativeLabel: `pred ${formatMinutesSk(minutes)}`,
    compactLabel: isOffline ? 'Offline' : 'Online',
    absoluteLabel: formatAbsoluteDateTime(timestamp),
    warningMessage: isOffline
      ? `ESP32 neposlal nové dáta viac ako ${OFFLINE_AFTER_MINUTES} minúty.`
      : null
  };
}

function normalizeBackendStatus(status) {
  const minutes = status.minutes_since_last_sync;
  const lastSyncAt = status.last_sync_at || null;
  const lastSuccessfulMessageAt = status.last_successful_message_at || lastSyncAt;

  return {
    status: status.status,
    label: status.label,
    isOnline: Boolean(status.is_online),
    isOffline: Boolean(status.is_offline),
    isNoData: Boolean(status.is_no_data),
    stale: Boolean(status.is_stale),
    minutesSinceLastSync: minutes,
    lastSyncAt,
    lastSuccessfulMessageAt,
    relativeLabel: lastSyncAt ? `pred ${formatMinutesSk(minutes)}` : 'ešte neprišli žiadne dáta',
    compactLabel: status.is_no_data ? 'Bez dát' : status.is_offline ? 'Offline' : 'Online',
    absoluteLabel: lastSyncAt ? formatAbsoluteDateTime(lastSyncAt) : 'Žiadna správa zo senzora',
    warningMessage: status.warning_message || null
  };
}

export function formatAbsoluteDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} - ${hours}:${minutes}`;
}

export function formatMinutesSk(minutes) {
  if (minutes == null) return 'neznámo';
  if (minutes < 1) return 'menej ako minútou';
  if (minutes < 60) return `${minutes} ${pluralizeSk(minutes, 'minútou', 'minútami', 'minútami')}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralizeSk(hours, 'hodinou', 'hodinami', 'hodinami')}`;

  const days = Math.floor(hours / 24);
  return `${days} ${pluralizeSk(days, 'dňom', 'dňami', 'dňami')}`;
}

function pluralizeSk(value, one, few, many) {
  if (value === 1) return one;
  if (value >= 2 && value <= 4) return few;
  return many;
}
