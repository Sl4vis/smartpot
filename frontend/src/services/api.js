import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// ── Plants ──────────────────────────────────────
export const getPlants = () => api.get('/plants').then(r => r.data.data);
export const getPlant = (id) => api.get(`/plants/${id}`).then(r => r.data.data);
export const createPlant = (data) => api.post('/plants', data).then(r => r.data.data);
export const updatePlant = (id, data) => api.put(`/plants/${id}`, data).then(r => r.data.data);
export const deletePlant = (id) => api.delete(`/plants/${id}`);
export const waterPlant = (id, data = {}) => api.post(`/plants/${id}/water`, data).then(r => r.data.data);
export const getWateringHistory = (id, limit = 20) =>
  api.get(`/plants/${id}/watering-history?limit=${limit}`).then(r => r.data.data);

// ── Sensors ─────────────────────────────────────
export const getAvailableDevices = (currentPlantId = null) =>
  api.get(`/sensors/devices/available${currentPlantId ? `?currentPlantId=${currentPlantId}` : ''}`).then(r => r.data.data);
export const getLatestReading = async (deviceId) => {
  const response = await api.get(`/sensors/${deviceId}/latest`);
  return response.data.data;
};
export const getDeviceStatus = (deviceId) =>
  api.get(`/sensors/${deviceId}/status`).then(r => r.data.data);
export const getSensorHistory = (deviceId, hours = 24) =>
  api.get(`/sensors/${deviceId}/history?hours=${hours}`).then(r => r.data.data);
export const getRecentReadings = (deviceId, limit = 50) =>
  api.get(`/sensors/${deviceId}?limit=${limit}`).then(r => r.data.data);

// ── AI ──────────────────────────────────────────
export const analyzeHealth = (plantId) =>
  api.post(`/ai/analyze/${plantId}`).then(r => r.data.data);
export const getAnalysisHistory = (plantId, limit = 10) =>
  api.get(`/ai/history/${plantId}?limit=${limit}`).then(r => r.data.data);
export const suggestThresholds = (species) =>
  api.post('/ai/suggest-thresholds', { species }).then(r => r.data.data);

// ── Dashboard ───────────────────────────────────
export const getDashboardOverview = () =>
  api.get('/dashboard/overview').then(r => r.data.data);
export const getAlerts = (limit = 50) =>
  api.get(`/dashboard/alerts?limit=${limit}`).then(r => r.data.data);
export const markAlertRead = (id) =>
  api.put(`/dashboard/alerts/${id}/read`).then(r => r.data.data);
export const markAllAlertsRead = (plantId = null) =>
  api.put('/dashboard/alerts/read-all', plantId ? { plant_id: plantId } : {}).then(r => r.data);

// ── Notifications ───────────────────────────────
export const getNotificationConfig = () =>
  api.get('/notifications/config').then(r => r.data.data);
export const subscribePushNotifications = (subscription, platform = null) =>
  api.post('/notifications/subscribe', { subscription, platform }).then(r => r.data.data);
export const unsubscribePushNotifications = (endpoint) =>
  api.post('/notifications/unsubscribe', { endpoint }).then(r => r.data);
export const sendPushTestNotification = (subscription) =>
  api.post('/notifications/test', { subscription }).then(r => r.data);

// ── Health ──────────────────────────────────────
export const healthCheck = () => api.get('/health').then(r => r.data);

export default api;
