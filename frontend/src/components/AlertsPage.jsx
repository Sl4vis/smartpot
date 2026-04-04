import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Droplets,
  Sun,
  Thermometer,
  Leaf
} from 'lucide-react';
import {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  getNotificationConfig,
  subscribePushNotifications,
  unsubscribePushNotifications
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
  requiresInstalledAppForPush,
  isStandaloneMode,
  isIosDevice
} from '../services/browserNotifications';

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
  const pieces = [alert.plant?.species, alert.plant?.location, alert.device_id].filter(Boolean);
  return pieces.length ? pieces.join(' · ') : 'Bez detailu rastliny';
}

function sortGroups(a, b) {
  if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
  return new Date(b.latestAt) - new Date(a.latestAt);
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(isNotificationsEnabledByUser());
  const [permission, setPermission] = useState(getNotificationPermission());
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [pushConfig, setPushConfig] = useState({ push_available: false, vapid_public_key: null, digest_interval_minutes: 60 });
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [alertsData, configData, existingSubscription] = await Promise.all([
          getAlerts().catch(() => null),
          getNotificationConfig().catch(() => null),
          getExistingPushSubscription().catch(() => null)
        ]);

        setAlerts(alertsData?.length ? alertsData : DEMO_ALERTS);
        if (configData) setPushConfig(configData);
        const hasSubscription = Boolean(existingSubscription);
        setHasPushSubscription(hasSubscription);
        setNotificationsEnabled(isNotificationsEnabledByUser() && hasSubscription);
      } catch {
        setAlerts(DEMO_ALERTS);
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

  async function handleNotificationToggle() {
    if (notificationsEnabled) {
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
      return;
    }

    if (!pushConfig.push_available || !pushConfig.vapid_public_key) {
      alert('Push upozornenia ešte nie sú pripravené na serveri.');
      return;
    }

    if (requiresInstalledAppForPush()) {
      alert('Na iPhone si najprv pridaj SmartPot na plochu a otvor ho z ikonky. Potom klikni znovu na zvonček.');
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

      if (!result.granted) {
        if (result.permission === 'denied') {
          alert('Upozornenia sú v prehliadači blokované. Povoľ ich pri adrese stránky a skús to znova.');
        }
        return;
      }

      const subscription = await subscribeToPush(pushConfig.vapid_public_key);
      const serialized = subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription));
      await subscribePushNotifications(serialized, detectPlatformLabel());

      setNotificationsEnabledByUser(true);
      setNotificationsEnabled(true);
      setHasPushSubscription(true);
    } catch (error) {
      console.error('Enable push notifications failed:', error);
      alert('Nepodarilo sa zapnúť push upozornenia. Skontroluj povolenie v prehliadači a otvorenie cez HTTPS.');
    } finally {
      setPermissionBusy(false);
    }
  }

  const unread = alerts.filter(alert => !alert.read).length;

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

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        alerts: [...group.alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }))
      .sort(sortGroups);
  }, [alerts]);

  useEffect(() => {
    setCollapsedGroups(prev => {
      const next = { ...prev };
      const validIds = new Set(groupedAlerts.map(group => group.id));

      Object.keys(next).forEach((key) => {
        if (!validIds.has(key)) delete next[key];
      });

      groupedAlerts.forEach((group, index) => {
        if (!(group.id in next)) {
          next[group.id] = group.unreadCount === 0 ? true : index > 0;
        }
      });

      return next;
    });
  }, [groupedAlerts]);

  function toggleGroup(groupId) {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }

  const compactNotificationHint = getCompactNotificationHint({
    notificationsEnabled,
    hasPushSubscription,
    permission,
    pushAvailable: pushConfig.push_available,
    digestInterval: pushConfig.digest_interval_minutes
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Upozornenia</h1>
          <p className="text-sm text-sage-500 mt-1">
            {unread > 0 ? `${unread} neprečítaných` : 'Všetky upozornenia sú prečítané'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <NotificationToggleButton
            enabled={notificationsEnabled && hasPushSubscription}
            busy={permissionBusy}
            unsupported={!isNotificationApiSupported()}
            onClick={handleNotificationToggle}
          />

          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || unread === 0}
            className="btn-secondary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {markingAll ? <CheckCheck className="w-4 h-4 animate-pulse" /> : <CheckCheck className="w-4 h-4" />}
            Označiť všetky ako prečítané
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-sage-500 px-1">
        {notificationsEnabled && hasPushSubscription ? (
          <Bell className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <BellOff className="w-3.5 h-3.5 text-sage-400" />
        )}
        <span>{compactNotificationHint}</span>
      </div>

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
          {groupedAlerts.map((group, index) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]);

            return (
              <section key={group.id} className={`card p-4 sm:p-5 fade-in delay-${Math.min(index + 1, 4)}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full text-left flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-green-900">{group.title}</h2>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${group.unreadCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                          <Bell className="w-3.5 h-3.5" />
                          {group.unreadCount > 0 ? `${group.unreadCount} nové` : 'Všetko prečítané'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sage-50 text-sage-500 text-[11px] font-semibold">
                          {group.alerts.length} {group.alerts.length === 1 ? 'upozornenie' : group.alerts.length < 5 ? 'upozornenia' : 'upozornení'}
                        </span>
                      </div>
                      <p className="text-sm text-sage-500 truncate mt-1">{group.subtitle}</p>
                      <p className="text-xs text-sage-400 mt-1">
                        Posledné upozornenie: {new Date(group.latestAt).toLocaleString('sk')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sage-500 self-start sm:self-center">
                    <span className="text-xs font-medium">{isCollapsed ? 'Rozbaliť' : 'Zabaliť'}</span>
                    <span className="w-9 h-9 rounded-xl bg-sage-50 flex items-center justify-center">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="space-y-3 mt-4">
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
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationToggleButton({ enabled, busy, unsupported, onClick }) {
  const label = unsupported
    ? 'Push upozornenia nie sú dostupné v tomto prehliadači'
    : enabled
      ? 'Vypnúť push upozornenia'
      : 'Zapnúť push upozornenia';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || unsupported}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${enabled ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-sage-200 bg-white text-sage-500 hover:bg-sage-50'}`}
    >
      {enabled ? <Bell className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} /> : <BellOff className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} />}
    </button>
  );
}

function getCompactNotificationHint({ notificationsEnabled, hasPushSubscription, permission, pushAvailable, digestInterval }) {
  if (!pushAvailable) {
    return 'Push upozornenia ešte nie sú pripravené na serveri.';
  }

  if (permission === 'denied') {
    return 'Upozornenia sú v prehliadači blokované. Povoľ ich pri adrese stránky.';
  }

  if (requiresInstalledAppForPush()) {
    return 'Na iPhone ich zapneš po pridaní SmartPot na plochu a otvorení z ikonky.';
  }

  if (notificationsEnabled && hasPushSubscription) {
    return `Pri problémoch dostaneš približne raz za ${digestInterval || 60} minút stručný súhrn.`;
  }

  if (permission === 'unsupported') {
    return 'Tento prehliadač nepodporuje push upozornenia.';
  }

  if (isIosDevice() && !isStandaloneMode()) {
    return 'Na iPhone sa zvonček zapína až v nainštalovanej web appke.';
  }

  return 'Klikni na zvonček, ak chceš diskrétne hodinové upozornenia na rastliny s problémom.';
}

function detectPlatformLabel() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  return 'web';
}
