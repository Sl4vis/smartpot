const express = require('express');
const router = express.Router();
const { supabase } = require('../models/supabase');
const { buildDeviceStatus } = require('../utils/deviceStatus');

function normalizeOptionalNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPlantPayload(body = {}) {
  const payload = {};

  if ('name' in body) payload.name = body.name?.trim?.() || body.name || null;
  if ('species' in body) payload.species = body.species?.trim?.() || null;
  if ('device_id' in body) payload.device_id = body.device_id?.trim?.() || body.device_id || null;
  if ('location' in body) payload.location = body.location?.trim?.() || null;
  if ('image_url' in body) payload.image_url = body.image_url?.trim?.() || null;

  if ('min_soil_moisture' in body) payload.min_soil_moisture = normalizeOptionalNumber(body.min_soil_moisture, 30);
  if ('max_soil_moisture' in body) payload.max_soil_moisture = normalizeOptionalNumber(body.max_soil_moisture, 80);
  if ('min_temperature' in body) payload.min_temperature = normalizeOptionalNumber(body.min_temperature, 15);
  if ('max_temperature' in body) payload.max_temperature = normalizeOptionalNumber(body.max_temperature, 30);
  if ('min_light' in body) payload.min_light = normalizeOptionalNumber(body.min_light, 200);
  if ('max_light' in body) payload.max_light = normalizeOptionalNumber(body.max_light, 10000);

  return payload;
}

async function findPlantByDeviceId(deviceId) {
  if (!deviceId) return null;

  const { data, error } = await supabase
    .from('plants')
    .select('id, name, device_id')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// GET /api/plants - Všetky rastliny
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Plants fetch error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní rastlín' });
  }
});

// GET /api/plants/:id - Detail rastliny
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Rastlina nenájdená' });

    let latestReading = null;

    if (data.device_id) {
      const { data: latest, error: latestError } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', data.device_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestError && latestError.code !== 'PGRST116') throw latestError;
      latestReading = latest || null;
    }

    res.json({
      data: {
        ...data,
        latest_reading: latestReading,
        device_status: buildDeviceStatus(latestReading)
      }
    });
  } catch (err) {
    console.error('Plant detail error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní rastliny' });
  }
});

// POST /api/plants - Nová rastlina
router.post('/', async (req, res) => {
  try {
    const payload = buildPlantPayload(req.body);

    if (!payload.name || !payload.device_id) {
      return res.status(400).json({ error: 'name a device_id sú povinné' });
    }

    const existingPlant = await findPlantByDeviceId(payload.device_id);
    if (existingPlant) {
      return res.status(409).json({
        error: `Zariadenie ${payload.device_id} je už priradené k rastline „${existingPlant.name}“`
      });
    }

    const { data, error } = await supabase
      .from('plants')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    console.error('Plant create error:', err.message);
    res.status(500).json({ error: 'Chyba pri vytváraní rastliny' });
  }
});

// PUT /api/plants/:id - Uprav rastlinu
router.put('/:id', async (req, res) => {
  try {
    const payload = buildPlantPayload(req.body);

    if (payload.name === null || payload.device_id === null) {
      return res.status(400).json({ error: 'name a device_id sú povinné' });
    }

    if (payload.device_id) {
      const existingPlant = await findPlantByDeviceId(payload.device_id);
      if (existingPlant && existingPlant.id !== req.params.id) {
        return res.status(409).json({
          error: `Zariadenie ${payload.device_id} je už priradené k rastline „${existingPlant.name}“`
        });
      }
    }

    const { data, error } = await supabase
      .from('plants')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Plant update error:', err.message);
    res.status(500).json({ error: 'Chyba pri úprave rastliny' });
  }
});

// DELETE /api/plants/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('plants')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Plant delete error:', err.message);
    res.status(500).json({ error: 'Chyba pri mazaní rastliny' });
  }
});

// POST /api/plants/:id/water - Zaznamenaj polievanie
router.post('/:id/water', async (req, res) => {
  try {
    const { amount_ml, notes } = req.body;

    const { data, error } = await supabase
      .from('watering_log')
      .insert({
        plant_id: req.params.id,
        amount_ml: amount_ml || null,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    console.error('Plant water error:', err.message);
    res.status(500).json({ error: 'Chyba pri zaznamenaní polievania' });
  }
});

// GET /api/plants/:id/watering-history
router.get('/:id/watering-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;

    const { data, error } = await supabase
      .from('watering_log')
      .select('*')
      .eq('plant_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Watering history error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní histórie polievania' });
  }
});

module.exports = router;
