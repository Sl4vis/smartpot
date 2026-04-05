export const OFFLINE_AFTER_MINUTES = 3;

export function getDeviceStatus(readingOrTimestamp) {
  const timestamp = typeof readingOrTimestamp === 'string'
    ? readingOrTimestamp
    : readingOrTimestamp?.created_at || null;

  // Ak nie sú žiadne dáta → Offline
  if (!timestamp) {
    return {
      status: 'offline',
      label: 'Offline',
      isOnline: false,
      isOffline: true,
      isNoData: false,
      stale: true,
      minutesSinceLastSync: null,
      lastSyncAt: null,
      lastSuccessfulMessageAt: null,
      relativeLabel: 'žiadne dáta',
      compactLabel: 'offline',
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
    compactLabel: isOffline ? `offline · ${formatMinutesCompact(minutes)}` : `pred ${formatMinutesCompact(minutes)}`,
    absoluteLabel: formatAbsoluteDateTime(timestamp),
    warningMessage: isOffline
      ? `ESP32 neposlal nové dáta viac ako ${OFFLINE_AFTER_MINUTES} minúty.`
      : null
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
  if (minutes < 1) return 'menej ako minútou';
  if (minutes < 60) return `${minutes} ${pluralizeSk(minutes, 'minútou', 'minútami', 'minútami')}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralizeSk(hours, 'hodinou', 'hodinami', 'hodinami')}`;

  const days = Math.floor(hours / 24);
  return `${days} ${pluralizeSk(days, 'dňom', 'dňami', 'dňami')}`;
}

export function formatMinutesCompact(minutes) {
  if (minutes == null) return '—';
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function pluralizeSk(value, one, few, many) {
  if (value === 1) return one;
  if (value >= 2 && value <= 4) return few;
  return many;
}
