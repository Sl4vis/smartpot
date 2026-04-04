import { useEffect } from 'react';
import { getDashboardOverview } from '../services/api';
import {
  isNotificationsEnabledByUser,
  getNotificationPermission,
  shouldSendHourlyNotification,
  markNotificationSent,
  buildNotificationPayload,
  showBrowserNotification
} from '../services/browserNotifications';

async function checkNotifications() {
  if (!isNotificationsEnabledByUser()) return;
  if (getNotificationPermission() !== 'granted') return;
  if (!shouldSendHourlyNotification()) return;

  try {
    const overview = await getDashboardOverview();
    const payload = buildNotificationPayload(overview || []);
    if (!payload) return;

    const shown = await showBrowserNotification(payload);
    if (shown) markNotificationSent();
  } catch (error) {
    console.error('Hourly notification check failed:', error);
  }
}

export default function NotificationWatcher() {
  useEffect(() => {
    checkNotifications();

    const interval = window.setInterval(checkNotifications, 5 * 60 * 1000);
    const handleFocus = () => { checkNotifications(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkNotifications();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
