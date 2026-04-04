import { getCookie, setCookie, deleteCookie } from '../utils/cookies';

const ENABLED_COOKIE = 'smartpot_browser_notifications_enabled';

export function isNotificationApiSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushSupported() {
  return isNotificationApiSupported()
    && typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

export function isNotificationsEnabledByUser() {
  return getCookie(ENABLED_COOKIE) === 'true';
}

export function setNotificationsEnabledByUser(enabled) {
  if (enabled) setCookie(ENABLED_COOKIE, 'true');
  else deleteCookie(ENABLED_COOKIE);
}

export function getNotificationPermission() {
  if (!isNotificationApiSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationApiSupported()) {
    return { granted: false, permission: 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  return { granted: permission === 'granted', permission };
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function requiresInstalledAppForPush() {
  return isIosDevice() && !isStandaloneMode();
}

export function getPushSupportHint() {
  if (!isNotificationApiSupported()) {
    return 'Tento prehliadač nepodporuje web notifikácie.';
  }

  if (requiresInstalledAppForPush()) {
    return 'Na iPhone treba najprv pridať SmartPot na plochu cez Zdieľať → Pridať na plochu a potom ho otvoriť z ikonky.';
  }

  if (!isPushSupported()) {
    return 'Push notifikácie nie sú v tomto prehliadači dostupné. Skús Chrome, Edge alebo nainštalovanú PWA.';
  }

  return 'Po povolení bude backend posielať hodinový súhrn aj keď je web zavretý.';
}

export async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service worker nie je podporovaný.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration || navigator.serviceWorker.ready;
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await ensureServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey) {
  if (!isPushSupported()) {
    throw new Error('Push notifikácie nie sú podporované.');
  }

  if (!vapidPublicKey) {
    throw new Error('Chýba VAPID public key zo servera.');
  }

  const registration = await ensureServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    appServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
}

export async function unsubscribeFromPush() {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return false;
  await subscription.unsubscribe();
  return true;
}

export async function showBrowserNotification(payload) {
  if (!payload || !isNotificationApiSupported() || Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag || 'smartpot-local-preview',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/icon-badge.png',
        renotify: Boolean(payload.renotify),
        data: payload.data || { url: '/alerts' }
      });
      return true;
    }

    // eslint-disable-next-line no-new
    new Notification(payload.title, { body: payload.body });
    return true;
  } catch (err) {
    console.error('Notification error:', err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}
