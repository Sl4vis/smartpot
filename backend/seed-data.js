/**
 * seed-data.js - Vygeneruje realistické senzorové dáta rozložené v čase
 * Použitie: node seed-data.js https://smartpot-api.onrender.com/api
 */
const API = process.argv[2] || 'https://smartpot-api.onrender.com/api';

async function seed() {
  console.log(`Seedujem: ${API}\n`);
  const res = await fetch(`${API}/plants`);
  const { data: plants } = await res.json();
  if (!plants?.length) { console.log('Žiadne rastliny.'); return; }

  for (const plant of plants) {
    console.log(`${plant.name} (${plant.device_id})`);
    const now = Date.now();
    let sent = 0;

    for (let i = 95; i >= 0; i--) {
      const ts = new Date(now - i * 30 * 60000);
      const hr = ts.getHours();
      const day = hr >= 6 && hr <= 20;
      const dp = day ? (hr - 6) / 14 : 0;

      const moist = Math.max(20, Math.min(80, 60 - i * 0.3 + (i % 30 === 0 ? 25 : 0) + (Math.random() - 0.5) * 5));
      const temp = (day ? 20 + dp * 5 : 18) + (Math.random() - 0.5) * 2;
      const hum = Math.max(30, Math.min(80, 65 - (temp - 20) * 2 + (Math.random() - 0.5) * 5));
      const peak = (plant.min_light || 300) * 3;
      const light = Math.max(0, (day ? peak * Math.sin(dp * Math.PI) : 5) + (Math.random() - 0.5) * 100);

      try {
        const r = await fetch(`${API}/sensors`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: plant.device_id,
            soil_moisture: Math.round(moist * 10) / 10,
            temperature: Math.round(temp * 10) / 10,
            humidity: Math.round(hum * 10) / 10,
            light_lux: Math.round(light * 10) / 10,
            created_at: ts.toISOString()
          })
        });
        if (r.ok) sent++;
      } catch {}
    }
    console.log(`  ${sent}/96 meraní\n`);
  }
  console.log('Hotovo!');
}

seed().catch(console.error);
