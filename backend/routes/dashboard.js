const express = require('express');
const router = express.Router();
const { supabase } = require('../models/supabase');
const { buildDeviceStatus } = require('../utils/deviceStatus');

async function fetchAlerts(limit = 50) {
  const { data, error } = await supabase
    .from('alerts')
    .select(`
      *,
      plant:plants (
        id,
        name,
        species,
        location,
        device_id
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!error) return data || [];

  const { data: fallback, error: fallbackError } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallbackError) throw fallbackError;

  const plantIds = [...new Set((fallback || []).map(a => a.plant_id).filter(Boolean))];
  if (plantIds.length === 0) return fallback || [];

  const { data: plants, error: plantError } = await supabase
    .from('plants')
    .select('id, name, species, location, device_id')
    .in('id', plantIds);

  if (plantError) throw plantError;

  const plantsById = new Map((plants || []).map(plant => [plant.id, plant]));
  return (fallback || []).map(alert => ({
    ...alert,
    plant: alert.plant_id ? plantsById.get(alert.plant_id) || null : null
  }));
}

// GET /api/dashboard/overview - Prehľad všetkých rastlín
router.get('/overview', async (req, res) => {
  try {
    const { data: plants, error: plantError } = await supabase
      .from('plants')
      .select('*')
      .order('created_at', { ascending: false });

    if (plantError) throw plantError;

    const overview = await Promise.all(
      (plants || []).map(async (plant) => {
        const { data: latestReading } = await supabase
          .from('sensor_readings')
          .select('*')
          .eq('device_id', plant.device_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: latestAnalysis } = await supabase
          .from('ai_analyses')
          .select('health_score, status, summary, watering_needed')
          .eq('plant_id', plant.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { count: alertCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', plant.device_id)
          .eq('read', false);

        return {
          plant,
          latest_reading: latestReading || null,
          latest_analysis: latestAnalysis || null,
          unread_alerts: alertCount || 0,
          device_status: buildDeviceStatus(latestReading || null)
        };
      })
    );

    res.json({ data: overview });
  } catch (err) {
    console.error('Dashboard overview error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní prehľadu' });
  }
});

// GET /api/dashboard/alerts - Všetky alerty + informácie o rastline
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const data = await fetchAlerts(limit);
    res.json({ data });
  } catch (err) {
    console.error('Alerts fetch error:', err.message);
    res.status(500).json({ error: 'Chyba pri načítavaní alertov' });
  }
});

// PUT /api/dashboard/alerts/read-all - Označ všetky alerty ako prečítané
router.put('/alerts/read-all', async (req, res) => {
  try {
    const { plant_id } = req.body || {};

    let query = supabase
      .from('alerts')
      .update({ read: true })
      .eq('read', false);

    if (plant_id) query = query.eq('plant_id', plant_id);

    const { data, error } = await query.select('id');

    if (error) throw error;
    res.json({
      success: true,
      updated_count: data?.length || 0
    });
  } catch (err) {
    console.error('Alerts read-all error:', err.message);
    res.status(500).json({ error: 'Chyba pri označení alertov ako prečítaných' });
  }
});

// PUT /api/dashboard/alerts/:id/read - Označ alert ako prečítaný
router.put('/alerts/:id/read', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Alert read error:', err.message);
    res.status(500).json({ error: 'Chyba pri aktualizácii alertu' });
  }
});

module.exports = router;
