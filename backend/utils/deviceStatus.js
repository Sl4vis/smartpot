const OFFLINE_AFTER_MINUTES = Number(process.env.DEVICE_OFFLINE_AFTER_MINUTES || 2);

function buildDeviceStatus(latestReading) {
  const timestamp = latestReading?.created_at || null;

  if (!timestamp) {
    return {
      status: 'no_data',
      label: 'Bez dát',
      offline_after_minutes: OFFLINE_AFTER_MINUTES,
      is_online: false,
      is_offline: false,
      is_no_data: true,
      is_stale: true,
      minutes_since_last_sync: null,
      last_sync_at: null,
      last_successful_message_at: null,
      warning_message: 'Zariadenie ešte neposlalo žiadne meranie.'
    };
  }

  const minutesSinceLastSync = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
  );
  const isOffline = minutesSinceLastSync >= OFFLINE_AFTER_MINUTES;

  return {
    status: isOffline ? 'offline' : 'online',
    label: isOffline ? 'Offline' : 'Online',
    offline_after_minutes: OFFLINE_AFTER_MINUTES,
    is_online: !isOffline,
    is_offline: isOffline,
    is_no_data: false,
    is_stale: isOffline,
    minutes_since_last_sync: minutesSinceLastSync,
    last_sync_at: timestamp,
    last_successful_message_at: timestamp,
    warning_message: isOffline
      ? `Zariadenie neposlalo nové dáta viac ako ${OFFLINE_AFTER_MINUTES} minúty.`
      : null
  };
}

module.exports = {
  OFFLINE_AFTER_MINUTES,
  buildDeviceStatus
};
