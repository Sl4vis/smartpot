const express = require('express');
const router = express.Router();
const { supabase } = require('../models/supabase');
const { buildDeviceStatus } = require('../utils/deviceStatus');

async function fetchAlerts(userId, limit = 50) {
  const { data: userPlants } = await supabase
    .from('plants').select('id, device_id').eq('user_id', userId);

  if (!userPlants?.length) return [];

  const plantIds = userPlants.map(p => p.id).filter(Boolean);
  const deviceIds = userPlants.map(p => p.device_id).filter(Boolean);

  // Ak nie su ziadne platne ID, vrat prazdny zoznam
  if (!plantIds.length && !deviceIds.length) return [];

  // Postav filter dynamicky - vyhni sa prazdnym in.()
  let filterParts = [];
  if (plantIds.length) filterParts.push(`plant_id.in.(${plantIds.join(',')})`);
  if (deviceIds.length) filterParts.push(`device_id.in.(${deviceIds.join(',')})`);

  try {
    const { data, error } = await supabase
      .from('alerts').select('*, plant:plants(id, name, species, location, device_id)')
      .or(filterParts.join(','))
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    // Fallback bez join
    try {
      const { data: fallback } = await supabase
        .from('alerts').select('*')
        .or(filterParts.join(','))
        .order('created_at', { ascending: false }).limit(limit);
      return fallback || [];
    } catch {
      return [];
    }
  }
}

// GET /api/dashboard/overview
router.get('/overview', async (req, res) => {
  try {
    const { data: plants, error: plantError } = await supabase
      .from('plants').select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (plantError) throw plantError;
    if (!plants?.length) return res.json({ data: [] });

    const overview = await Promise.all(
      plants.map(async (plant) => {
        let latestReading = null;
        let latestAnalysis = null;
        let alertCount = 0;

        // Len ak ma zariadenie priradene
        if (plant.device_id) {
          try {
            const { data: lr } = await supabase
              .from('sensor_readings').select('*')
              .eq('device_id', plant.device_id)
              .order('created_at', { ascending: false }).limit(1).maybeSingle();
            latestReading = lr;
          } catch {}

          try {
            const { count } = await supabase
              .from('alerts').select('*', { count: 'exact', head: true })
              .eq('device_id', plant.device_id).eq('read', false);
            alertCount = count || 0;
          } catch {}
        }

        try {
          const { data: la } = await supabase
            .from('ai_analyses').select('health_score, status, summary, watering_needed')
            .eq('plant_id', plant.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          latestAnalysis = la;
        } catch {}

        return {
          plant,
          latest_reading: latestReading,
          latest_analysis: latestAnalysis,
          unread_alerts: alertCount,
          device_status: buildDeviceStatus(latestReading)
        };
      })
    );

    res.json({ data: overview });
  } catch (err) {
    console.error('Dashboard overview error:', err.message);
    res.status(500).json({ error: 'Chyba pri nacitavani prehladu' });
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const data = await fetchAlerts(req.userId, limit);
    res.json({ data });
  } catch (err) {
    console.error('Alerts fetch error:', err.message);
    res.status(500).json({ error: 'Chyba pri nacitavani alertov' });
  }
});

// PUT /api/dashboard/alerts/read-all
router.put('/alerts/read-all', async (req, res) => {
  try {
    const { plant_id } = req.body || {};
    let query = supabase.from('alerts').update({ read: true }).eq('read', false);
    if (plant_id) query = query.eq('plant_id', plant_id);
    const { data, error } = await query.select('id');
    if (error) throw error;
    res.json({ success: true, updated_count: data?.length || 0 });
  } catch (err) {
    console.error('Alerts read-all error:', err.message);
    res.status(500).json({ error: 'Chyba pri oznaceni alertov' });
  }
});

// PUT /api/dashboard/alerts/:id/read
router.put('/alerts/:id/read', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alerts').update({ read: true }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Alert read error:', err.message);
    res.status(500).json({ error: 'Chyba pri aktualizacii alertu' });
  }
});

module.exports = router;
