const express = require('express');
const router = express.Router();
const { supabase } = require('../models/supabase');
const { buildDeviceStatus } = require('../utils/deviceStatus');

const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 60);

// GET /api/sensors/devices/available - Zariadenia ktoré posielajú dáta ale nemajú priradenú rastlinu
router.get('/devices/available', async (req, res) => {
  try {
    const currentPlantId = req.query.currentPlantId || null;

    const { data: allDevices, error: e1 } = await supabase
      .from('sensor_readings')
      .select('device_id')
      .order('created_at', { ascending: false });

    if (e1) throw e1;

    const uniqueDevices = [...new Set((allDevices || []).map(d => d.device_id).filter(Boolean))];

    const { data: plants, error: e2 } = await supabase
      .from('plants')
      .select('id, device_id');

    if (e2) throw e2;

    const currentPlant = currentPlantId
      ? (plants || []).find(plant => plant.id === currentPlantId) || null
      : null;

    const assignedIds = new Set(
      (plants || [])
        .filter(plant => plant.id !== currentPlantId)
        .map(plant => plant.device_id)
        .filter(Boolean)
    );

    const available = uniqueDevices.filter(id => !assignedIds.has(id));
    const assigned = uniqueDevices.filter(id => assignedIds.has(id));

    if (currentPlant?.device_id && !available.includes(currentPlant.device_id)) {
      available.unshift(currentPlant.device_id);
    }

    res.json({
      data: {
        available,
        assigned,
        all: uniqueDevices,
        current_device: currentPlant?.device_id || null
      }
    });
  } catch (err) {
    console.error('Devices error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní zariadení' });
  }
});

// POST /api/sensors - ESP32 posiela dáta
router.post('/', async (req, res) => {
  try {
    const { device_id, soil_moisture, temperature, humidity, light_lux } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id je povinný' });
    }

    const reading = {
      device_id,
      soil_moisture: parseFloat(soil_moisture) || 0,
      temperature: parseFloat(temperature) || 0,
      humidity: parseFloat(humidity) || 0,
      light_lux: parseFloat(light_lux) || 0,
      created_at: req.body.created_at || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('sensor_readings')
      .insert(reading)
      .select()
      .single();

    if (error) throw error;
    await checkThresholds(device_id, reading);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Sensor POST error:', err.message);
    res.status(500).json({ error: 'Chyba pri ukladaní dát zo senzora' });
  }
});

// GET /api/sensors/:deviceId
router.get('/:deviceId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await supabase
      .from('sensor_readings').select('*')
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Chyba pri načítavaní dát' });
  }
});

// GET /api/sensors/:deviceId/latest
router.get('/:deviceId/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor_readings').select('*')
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;

    const latestReading = data || null;
    res.json({
      data: latestReading,
      device_status: buildDeviceStatus(latestReading)
    });
  } catch (err) {
    res.status(500).json({ error: 'Chyba pri načítavaní posledného merania' });
  }
});

// GET /api/sensors/:deviceId/status
router.get('/:deviceId/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor_readings').select('*')
      .eq('device_id', req.params.deviceId)
      .order('created_at', { ascending: false }).limit(1).single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      data: buildDeviceStatus(data || null)
    });
  } catch (err) {
    res.status(500).json({ error: 'Chyba pri načítavaní stavu zariadenia' });
  }
});

// GET /api/sensors/:deviceId/history
router.get('/:deviceId/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('sensor_readings').select('*')
      .eq('device_id', req.params.deviceId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ data, period_hours: hours });
  } catch (err) {
    res.status(500).json({ error: 'Chyba pri načítavaní histórie' });
  }
});

async function getRecentAlertTypes(plantId) {
  const since = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60000).toISOString();
  const { data, error } = await supabase
    .from('alerts')
    .select('type')
    .eq('plant_id', plantId)
    .gte('created_at', since);

  if (error) throw error;
  return new Set((data || []).map(item => item.type));
}

async function checkThresholds(deviceId, reading) {
  try {
    const { data: plant } = await supabase
      .from('plants').select('*').eq('device_id', deviceId).single();
    if (!plant) return;

    const recentTypes = await getRecentAlertTypes(plant.id);
    const alerts = [];

    if (reading.soil_moisture < (plant.min_soil_moisture || 30) && !recentTypes.has('low_moisture')) {
      alerts.push({
        device_id: deviceId,
        plant_id: plant.id,
        type: 'low_moisture',
        message: `Nízka vlhkosť pôdy: ${reading.soil_moisture}% (minimum: ${plant.min_soil_moisture}%)`,
        severity: 'warning'
      });
    }
    if (reading.temperature > (plant.max_temperature || 35) && !recentTypes.has('high_temperature')) {
      alerts.push({
        device_id: deviceId,
        plant_id: plant.id,
        type: 'high_temperature',
        message: `Vysoká teplota: ${reading.temperature}°C (maximum: ${plant.max_temperature}°C)`,
        severity: 'warning'
      });
    }
    if (reading.light_lux < (plant.min_light || 200) && !recentTypes.has('low_light')) {
      alerts.push({
        device_id: deviceId,
        plant_id: plant.id,
        type: 'low_light',
        message: `Málo svetla: ${reading.light_lux} lux (minimum: ${plant.min_light} lux)`,
        severity: 'info'
      });
    }

    if (alerts.length > 0) await supabase.from('alerts').insert(alerts);
  } catch (err) {
    console.error('Threshold check error:', err.message);
  }
}

module.exports = router;
