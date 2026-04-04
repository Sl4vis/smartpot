const express = require('express');
const router = express.Router();
const { supabase } = require('../models/supabase');
const { analyzePlantHealth, suggestThresholds } = require('../services/aiService');

// POST /api/ai/analyze/:plantId - AI analýza stavu rastliny
router.post('/analyze/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;

    const { data: plant, error: plantError } = await supabase
      .from('plants').select('*').eq('id', plantId).single();

    if (plantError || !plant) {
      return res.status(404).json({ error: 'Rastlina nenájdená' });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: readings, error: readError } = await supabase
      .from('sensor_readings').select('*')
      .eq('device_id', plant.device_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (readError) throw readError;

    if (!readings || readings.length === 0) {
      return res.status(400).json({ error: 'Žiadne dáta zo senzorov za posledných 24 hodín' });
    }

    const analysis = await analyzePlantHealth(plant, readings);

    await supabase.from('ai_analyses').insert({
      plant_id: plantId,
      health_score: analysis.health_score,
      status: analysis.status,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      watering_needed: analysis.watering_needed,
      raw_response: analysis
    });

    res.json({ data: analysis });
  } catch (err) {
    console.error('AI analysis error:', err.message);
    res.status(500).json({ error: 'Chyba pri AI analýze' });
  }
});

// POST /api/ai/suggest-thresholds - AI navrhne prahové hodnoty pre druh rastliny
router.post('/suggest-thresholds', async (req, res) => {
  try {
    const { species } = req.body;
    if (!species) {
      return res.status(400).json({ error: 'species je povinný' });
    }

    const result = await suggestThresholds(species);
    res.json({ data: result });
  } catch (err) {
    console.error('AI suggest error:', err.message);
    res.status(500).json({ error: 'Chyba pri AI odporúčaní' });
  }
});

// GET /api/ai/history/:plantId - História AI analýz
router.get('/history/:plantId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { data, error } = await supabase
      .from('ai_analyses').select('*')
      .eq('plant_id', req.params.plantId)
      .order('created_at', { ascending: false }).limit(limit);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Chyba pri načítavaní histórie analýz' });
  }
});

module.exports = router;
