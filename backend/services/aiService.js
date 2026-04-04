/**
 * AI Service - Groq API (Llama 3.3 70B) + Gemini fallback
 * Zadarmo, rýchle, 30 req/min, 14400 req/deň
 */

async function analyzePlantHealth(plantData, sensorReadings) {
  const latestReading = sensorReadings[0];
  const avgReadings = calculateAverages(sensorReadings);

  const prompt = `Si expert botanik a IoT špecialista. Analyzuj stav izbovej rastliny a daj odporúčania v slovenčine.

Rastlina: ${plantData.name}
Druh: ${plantData.species || 'neznámy'}
Umiestnenie: ${plantData.location || 'neuvedené'}

Aktuálne merania:
- Vlhkosť pôdy: ${latestReading.soil_moisture}%
- Teplota: ${latestReading.temperature}°C
- Vlhkosť vzduchu: ${latestReading.humidity}%
- Svetlo: ${latestReading.light_lux} lux

Priemer za posledných 24h:
- Vlhkosť pôdy: ${avgReadings.soil_moisture.toFixed(1)}%
- Teplota: ${avgReadings.temperature.toFixed(1)}°C
- Vlhkosť vzduchu: ${avgReadings.humidity.toFixed(1)}%
- Svetlo: ${avgReadings.light_lux.toFixed(0)} lux

Nastavené prahy:
- Vlhkosť pôdy: ${plantData.min_soil_moisture}% - ${plantData.max_soil_moisture}%
- Teplota: ${plantData.min_temperature}°C - ${plantData.max_temperature}°C
- Min. svetlo: ${plantData.min_light} lux

Odpovedz VÝHRADNE platným JSON:
{
  "health_score": <0-100>,
  "status": "<ok|warning|critical>",
  "summary": "<krátke zhrnutie stavu v 1-2 vetách>",
  "recommendations": [
    { "priority": "<high|medium|low>", "action": "<čo robiť>", "reason": "<prečo>" }
  ],
  "watering_needed": <true|false>,
  "next_watering_hours": <odhadovaný počet hodín do polievania>
}`;

  try {
    const result = await callAI(prompt);
    return { ...result, ai_provider: getProvider(), ai_success: true };
  } catch (err) {
    console.error('AI error:', err.message);
    const fallback = fallbackAnalysis(plantData, latestReading);
    return { ...fallback, ai_provider: 'fallback', ai_success: false };
  }
}

/**
 * AI navrhne prahové hodnoty pre daný druh rastliny
 */
async function suggestThresholds(species) {
  const prompt = `Si expert botanik. Pre izbovú rastlinu druhu "${species}" navrhni optimálne prahové hodnoty pre IoT senzory.

Vyhľadaj informácie o tomto druhu rastliny a na základe toho urči ideálne podmienky.

Odpovedz VÝHRADNE platným JSON:
{
  "min_soil_moisture": <minimálna vlhkosť pôdy v %>,
  "max_soil_moisture": <maximálna vlhkosť pôdy v %>,
  "min_temperature": <minimálna teplota v °C>,
  "max_temperature": <maximálna teplota v °C>,
  "min_light": <minimálne svetlo v lux>,
  "description": "<1-2 vety o nákoch tejto rastliny v slovenčine>"
}`;

  try {
    const result = await callAI(prompt);
    return { ...result, ai_success: true };
  } catch (err) {
    console.error('AI suggest error:', err.message);
    return {
      min_soil_moisture: 30, max_soil_moisture: 70,
      min_temperature: 18, max_temperature: 28,
      min_light: 300,
      description: 'Nepodarilo sa získať AI odporúčania pre tento druh.',
      ai_success: false
    };
  }
}

// ── Univerzálna AI funkcia ──────────────────────────
async function callAI(prompt) {
  // Skús Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return await callGroq(groqKey, prompt);
  }
  // Fallback Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return await callGemini(geminiKey, prompt);
  }
  throw new Error('Žiadny AI kľúč nie je nastavený');
}

function getProvider() {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'fallback';
}

// ── Groq API ────────────────────────────────────────
async function callGroq(apiKey, prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) throw new Error(`Groq: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Prázdna odpoveď z Groq');
  return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim());
}

// ── Gemini API ──────────────────────────────────────
async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: 'application/json' }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Prázdna odpoveď z Gemini');
  return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim());
}

// ── Pomocné funkcie ─────────────────────────────────
function calculateAverages(readings) {
  if (!readings || readings.length === 0) {
    return { soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0 };
  }
  const sum = readings.reduce((acc, r) => ({
    soil_moisture: acc.soil_moisture + (r.soil_moisture || 0),
    temperature: acc.temperature + (r.temperature || 0),
    humidity: acc.humidity + (r.humidity || 0),
    light_lux: acc.light_lux + (r.light_lux || 0)
  }), { soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0 });
  const c = readings.length;
  return { soil_moisture: sum.soil_moisture/c, temperature: sum.temperature/c, humidity: sum.humidity/c, light_lux: sum.light_lux/c };
}

function fallbackAnalysis(plant, reading) {
  const recs = [];
  let score = 100, status = 'ok';
  if (reading.soil_moisture < (plant.min_soil_moisture || 30)) {
    score -= 30;
    recs.push({ priority: 'high', action: 'Polejte rastlinu', reason: `Vlhkosť pôdy (${reading.soil_moisture}%) je pod minimom` });
  }
  if (reading.temperature > (plant.max_temperature || 30)) {
    score -= 20;
    recs.push({ priority: 'medium', action: 'Presuňte do chladnejšieho miesta', reason: `Teplota (${reading.temperature}°C) je vysoká` });
  }
  if (reading.light_lux < (plant.min_light || 200)) {
    score -= 15;
    recs.push({ priority: 'medium', action: 'Presuňte bližšie k oknu', reason: `Nedostatok svetla (${reading.light_lux} lux)` });
  }
  if (score < 50) status = 'critical'; else if (score < 75) status = 'warning';
  return {
    health_score: Math.max(0, score), status,
    summary: 'Analýza vykonaná lokálne (AI služba nedostupná).',
    recommendations: recs,
    watering_needed: reading.soil_moisture < (plant.min_soil_moisture || 30),
    next_watering_hours: reading.soil_moisture < 40 ? 0 : 12
  };
}

module.exports = { analyzePlantHealth, suggestThresholds };
