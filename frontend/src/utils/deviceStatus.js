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
      relativeLabel: 'zatiaľ bez dát',
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
    relativeLabel: minutes < 1 ? 'práve teraz' : `pred ${formatMinutesSk(minutes)}`,
    compactLabel: isOffline ? 'offline' : 'online',
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
    relativeLabel: lastSyncAt
      ? (minutes < 1 ? 'práve teraz' : `pred ${formatMinutesSk(minutes)}`)
      : 'zatiaľ bez dát',
    compactLabel: status.is_no_data ? 'bez dát' : status.is_offline ? 'offline' : 'online',
    absoluteLabel: lastSyncAt ? formatAbsoluteDateTime(lastSyncAt) : 'Žiadna správa zo senzora',
    warningMessage: status.warning_message || null
  };
}

export function formatAbsoluteDateTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('sk', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatMinutesSk(minutes) {
  if (minutes == null) return 'neznámo';
  if (minutes < 1) return 'chvíľou';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
