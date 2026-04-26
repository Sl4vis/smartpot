export const OFFLINE_AFTER_MINUTES = 3;

function getTimestamp(readingOrTimestamp) {
  if (typeof readingOrTimestamp === 'string') return readingOrTimestamp;

  return readingOrTimestamp?.created_at ||
    readingOrTimestamp?.lastSyncAt ||
    readingOrTimestamp?.last_sync_at ||
    readingOrTimestamp?.lastSuccessfulMessageAt ||
    readingOrTimestamp?.last_successful_message_at ||
    null;
}

export function isDeviceOnline(status) {
  if (!status) return false;
  if (typeof status.isOnline === 'boolean') return status.isOnline;
  if (typeof status.is_online === 'boolean') return status.is_online;
  return status.status === 'online';
}

export function normalizeDeviceStatus(statusOrReading) {
  const timestamp = getTimestamp(statusOrReading);
  const computed = getDeviceStatus(timestamp);

  if (!statusOrReading || typeof statusOrReading === 'string') {
    return computed;
  }

  const hasBackendStatus = Boolean(
    statusOrReading.status ||
    typeof statusOrReading.is_online === 'boolean' ||
    typeof statusOrReading.isOnline === 'boolean'
  );

  if (!hasBackendStatus) {
    return getDeviceStatus(statusOrReading);
  }

  const online = isDeviceOnline(statusOrReading);
  const isOffline = typeof statusOrReading.isOffline === 'boolean'
    ? statusOrReading.isOffline
    : typeof statusOrReading.is_offline === 'boolean'
      ? statusOrReading.is_offline
      : !online;

  return {
    ...computed,
    status: statusOrReading.status || (online ? 'online' : 'offline'),
    label: statusOrReading.label || (online ? 'Online' : 'Offline'),
    isOnline: online,
    isOffline,
    isNoData: statusOrReading.isNoData ?? statusOrReading.is_no_data ?? computed.isNoData,
    stale: statusOrReading.stale ?? statusOrReading.is_stale ?? computed.stale,
    minutesSinceLastSync: statusOrReading.minutesSinceLastSync ?? statusOrReading.minutes_since_last_sync ?? computed.minutesSinceLastSync,
    lastSyncAt: statusOrReading.lastSyncAt ?? statusOrReading.last_sync_at ?? computed.lastSyncAt,
    lastSuccessfulMessageAt: statusOrReading.lastSuccessfulMessageAt ?? statusOrReading.last_successful_message_at ?? computed.lastSuccessfulMessageAt,
    relativeLabel: statusOrReading.relativeLabel ?? computed.relativeLabel,
    compactLabel: statusOrReading.compactLabel ?? computed.compactLabel,
    absoluteLabel: statusOrReading.absoluteLabel ?? computed.absoluteLabel,
    warningMessage: statusOrReading.warningMessage ?? statusOrReading.warning_message ?? computed.warningMessage
  };
}

export function getDeviceStatus(readingOrTimestamp) {
  const timestamp = getTimestamp(readingOrTimestamp);

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

  const parsedTimestamp = new Date(timestamp).getTime();

  if (!Number.isFinite(parsedTimestamp)) {
    return getDeviceStatus(null);
  }

  const minutes = Math.max(0, Math.floor((Date.now() - parsedTimestamp) / 60000));
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
