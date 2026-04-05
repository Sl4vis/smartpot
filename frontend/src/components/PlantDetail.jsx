import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Droplets,
  Thermometer,
  Sun,
  Wind,
  Brain,
  Droplet,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  PencilLine
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import {
  getPlant,
  getSensorHistory,
  getLatestReading,
  analyzeHealth,
  waterPlant,
  getWateringHistory,
  getAnalysisHistory,
  deletePlant
} from '../services/api';
import GaugeRing from './GaugeRing';
import PlantEditModal from './PlantEditModal';
import { getDeviceStatus } from '../utils/deviceStatus';
import { getPlantEmoji } from '../utils/plantEmoji';

const DEMO_PLANT = {
  id: 'demo-1',
  name: 'Monstera',
  species: 'Monstera deliciosa',
  device_id: 'esp32-001',
  location: 'Obývačka',
  min_soil_moisture: 40,
  max_soil_moisture: 70,
  min_temperature: 18,
  max_temperature: 28,
  min_light: 300
};

const LIVE_REFRESH_MS = 20000;

function demoHistory() {
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => ({
    created_at: new Date(now - (47 - i) * 30 * 60000).toISOString(),
    soil_moisture: 45 + Math.sin(i / 6) * 15 + (Math.random() - 0.5) * 4,
    temperature: 21 + Math.sin(i / 10) * 3 + (Math.random() - 0.5) * 0.8,
    humidity: 55 + Math.cos(i / 8) * 10 + (Math.random() - 0.5) * 2,
    light_lux: Math.max(0, 600 + Math.sin((i - 12) / 7.6) * 500 + (Math.random() - 0.5) * 80)
  }));
}

const METRICS = [
  { key: 'soil_moisture', label: 'Vlhkosť pôdy', icon: Droplets, color: '#3b82f6', unit: '%' },
  { key: 'temperature', label: 'Teplota', icon: Thermometer, color: '#ef4444', unit: '°C' },
  { key: 'humidity', label: 'Vlhkosť vzduchu', icon: Wind, color: '#8b5cf6', unit: '%' },
  { key: 'light_lux', label: 'Svetlo', icon: Sun, color: '#f59e0b', unit: ' lux' }
];

function formatTooltipLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

function formatUpdatedAt(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return `${d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric', year: 'numeric' })} - ${d.toLocaleTimeString('sk', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function formatTickTime(ts, hours) {
  const d = new Date(ts);
  if (hours >= 48) {
    return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric' }) + '\n' +
      d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

const GAP_THRESHOLD_MS = 3 * 60 * 1000; // 3 minúty

/**
 * Spracuje surové dáta z histórie:
 * - Pokryje celý časový rozsah (now - hours → now)
 * - Nájde medzery (offline) a zapíše ich ako zóny
 * - Vráti { chartData, offlineZones, ticks }
 */
function processChartData(rawHistory, hours) {
  const now = Date.now();
  const rangeStart = now - hours * 60 * 60 * 1000;

  if (!rawHistory || rawHistory.length === 0) {
    // Celý rozsah je offline
    return {
      chartData: [
        { ts: rangeStart, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true },
        { ts: now, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true },
      ],
      offlineZones: [{ x1: rangeStart, x2: now }],
      ticks: generateTicks(rangeStart, now, hours)
    };
  }

  // Zoradiť podľa času
  const sorted = rawHistory
    .map(r => ({ ...r, ts: new Date(r.created_at).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  const chartData = [];
  const offlineZones = [];

  // Ak je medzera od rangeStart po prvý bod
  if (sorted[0].ts - rangeStart > GAP_THRESHOLD_MS) {
    chartData.push({ ts: rangeStart, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
    chartData.push({ ts: sorted[0].ts - 1000, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
    offlineZones.push({ x1: rangeStart, x2: sorted[0].ts });
  }

  for (let i = 0; i < sorted.length; i++) {
    chartData.push({ ...sorted[i], offline: false });

    // Kontrola medzery medzi aktuálnym a nasledujúcim bodom
    if (i < sorted.length - 1) {
      const gap = sorted[i + 1].ts - sorted[i].ts;
      if (gap > GAP_THRESHOLD_MS) {
        // Vložiť offline body
        chartData.push({ ts: sorted[i].ts + 1000, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
        chartData.push({ ts: sorted[i + 1].ts - 1000, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
        offlineZones.push({ x1: sorted[i].ts, x2: sorted[i + 1].ts });
      }
    }
  }

  // Ak je medzera od posledného bodu po now
  const lastTs = sorted[sorted.length - 1].ts;
  if (now - lastTs > GAP_THRESHOLD_MS) {
    chartData.push({ ts: lastTs + 1000, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
    chartData.push({ ts: now, soil_moisture: 0, temperature: 0, humidity: 0, light_lux: 0, offline: true });
    offlineZones.push({ x1: lastTs, x2: now });
  }

  return {
    chartData,
    offlineZones,
    ticks: generateTicks(rangeStart, now, hours)
  };
}

function generateTicks(start, end, hours) {
  const count = 6;
  const step = (end - start) / count;
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(start + i * step));
  }
  return ticks;
}

export default function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plant, setPlant] = useState(null);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [waterLog, setWaterLog] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [hours, setHours] = useState(24);
  const [metric, setMetric] = useState('soil_moisture');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Zoom & pan state
  const [zoomDomain, setZoomDomain] = useState(null); // { x1, x2 } alebo null
  const chartContainerRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startDomain: null });

  // Pri zmene hodín resetni zoom
  const handleHoursChange = useCallback((h) => {
    setHours(h);
    setZoomDomain(null);
  }, []);

  // Pomocné: full domain pre aktuálne dáta
  const getFullDomain = useCallback(() => {
    const { ticks: t } = processChartData(history, hours);
    if (!t || t.length < 2) return null;
    return { x1: t[0], x2: t[t.length - 1] };
  }, [history, hours]);

  // Natívny wheel listener s passive:false — blokuje scroll stránky nad grafom
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const full = getFullDomain();
      if (!full) return;

      const currentX1 = zoomDomain ? zoomDomain.x1 : full.x1;
      const currentX2 = zoomDomain ? zoomDomain.x2 : full.x2;
      const range = currentX2 - currentX1;

      const rect = container.getBoundingClientRect();
      const chartLeftPad = 52;
      const chartRightPad = 16;
      const chartWidth = rect.width - chartLeftPad - chartRightPad;
      const mouseX = Math.max(0, Math.min(1, (e.clientX - rect.left - chartLeftPad) / chartWidth));

      const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
      const newRange = range * zoomFactor;

      const minRange = 2 * 60 * 1000;
      const maxRange = full.x2 - full.x1;
      const clampedRange = Math.max(minRange, Math.min(maxRange, newRange));

      if (clampedRange >= maxRange * 0.99) {
        setZoomDomain(null);
        return;
      }

      const center = currentX1 + mouseX * range;
      let newX1 = center - mouseX * clampedRange;
      let newX2 = center + (1 - mouseX) * clampedRange;

      if (newX1 < full.x1) { newX2 += full.x1 - newX1; newX1 = full.x1; }
      if (newX2 > full.x2) { newX1 -= newX2 - full.x2; newX2 = full.x2; }
      newX1 = Math.max(full.x1, newX1);
      newX2 = Math.min(full.x2, newX2);

      setZoomDomain({ x1: Math.round(newX1), x2: Math.round(newX2) });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomDomain, getFullDomain]);

  // Drag-to-pan handlers
  const handleMouseDown = useCallback((e) => {
    if (!zoomDomain) return; // len keď je zoomnuté
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startDomain: { ...zoomDomain } };
    document.body.style.userSelect = 'none';
  }, [zoomDomain]);

  const handleMouseMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active || !d.startDomain) return;

    const container = chartContainerRef.current;
    if (!container) return;

    const full = getFullDomain();
    if (!full) return;

    const rect = container.getBoundingClientRect();
    const chartLeftPad = 52;
    const chartRightPad = 16;
    const chartWidth = rect.width - chartLeftPad - chartRightPad;

    const range = d.startDomain.x2 - d.startDomain.x1;
    const pxDelta = d.startX - e.clientX;
    const tsDelta = (pxDelta / chartWidth) * range;

    let newX1 = d.startDomain.x1 + tsDelta;
    let newX2 = d.startDomain.x2 + tsDelta;

    // Orezať na full range
    if (newX1 < full.x1) { newX2 += full.x1 - newX1; newX1 = full.x1; }
    if (newX2 > full.x2) { newX1 -= newX2 - full.x2; newX2 = full.x2; }

    setZoomDomain({ x1: Math.round(newX1), x2: Math.round(newX2) });
  }, [getFullDomain]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Prvé načítanie — len keď sa zmení id
  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const p = await getPlant(id);
        if (!mounted) return;
        setPlant(p);

        const [h, l, w, a] = await Promise.all([
          getSensorHistory(p.device_id, hours),
          getLatestReading(p.device_id),
          getWateringHistory(id).catch(() => []),
          getAnalysisHistory(id, 1).catch(() => [])
        ]);

        if (!mounted) return;
        setHistory(h || []);
        setLatest(l || p.latest_reading || null);
        setWaterLog(w || []);
        setAnalysis(a?.length ? a[0] : null);
        setDemoMode(false);
      } catch {
        if (!mounted) return;
        setPlant(DEMO_PLANT);
        const h = demoHistory();
        setHistory(h);
        setLatest(h[h.length - 1]);
        setAnalysis({
          health_score: 85,
          status: 'ok',
          summary: 'Rastlina je v dobrom stave.',
          recommendations: [{ priority: 'low', action: 'Pokračujte v polievaní', reason: 'Parametre sú v norme.' }],
          watering_needed: false,
          ai_success: true,
          ai_provider: 'groq'
        });
        setWaterLog([]);
        setDemoMode(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitial();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Prepnutie časového rozsahu — len refresh grafu, bez reloadu stránky
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!plant?.device_id || demoMode) return;

    let cancelled = false;
    setChartLoading(true);

    (async () => {
      try {
        const h = await getSensorHistory(plant.device_id, hours);
        if (!cancelled) setHistory(h || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hours]);

  useEffect(() => {
    if (!plant?.device_id || demoMode) return undefined;

    let cancelled = false;

    const refreshLive = async () => {
      try {
        const [h, l] = await Promise.all([
          getSensorHistory(plant.device_id, hours),
          getLatestReading(plant.device_id)
        ]);

        if (cancelled) return;
        setHistory(h || []);
        setLatest(l || null);
      } catch {
        // silent live refresh fail
      }
    };

    const interval = window.setInterval(refreshLive, LIVE_REFRESH_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshLive();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [plant?.device_id, hours, demoMode]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      setAnalysis(await analyzeHealth(id));
    } catch {
      alert('AI analýza zlyhala.');
    }
    setAnalyzing(false);
  }

  async function handleWater() {
    try {
      await waterPlant(id, { notes: 'Manuálne polievanie' });
      const [h, l, w] = await Promise.all([
        getSensorHistory(plant.device_id, hours).catch(() => history),
        getLatestReading(plant.device_id).catch(() => latest),
        getWateringHistory(id).catch(() => waterLog)
      ]);
      setHistory(h || []);
      setLatest(l || latest);
      setWaterLog(w || []);
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Naozaj chcete odstrániť "${plant.name}"? Táto akcia je nevratná.`)) return;
    try {
      await deletePlant(id);
      navigate('/');
    } catch {
      alert('Chyba pri odstraňovaní rastliny.');
    }
  }

  const activeMetric = useMemo(() => METRICS.find(m => m.key === metric), [metric]);
  const deviceStatus = plant?.device_status || getDeviceStatus(latest?.created_at || latest);

  const { chartData, offlineZones, ticks } = useMemo(
    () => processChartData(history, hours),
    [history, hours]
  );

  const aiSuccess = analysis?.ai_success === true ||
    (analysis?.summary && !analysis.summary.includes('lokálne') && !analysis.summary.includes('nedostupná'));
  const aiProvider = analysis?.ai_provider === 'groq' ? 'Groq (Llama 3.3)' :
    analysis?.ai_provider === 'gemini' ? 'Google Gemini' :
      (analysis?.ai_provider === 'fallback' ? 'Lokálna analýza' :
        (aiSuccess ? 'AI' : 'Lokálna analýza'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plant) return null;

  const r = latest || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-green-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-sage-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-green-900 truncate flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl select-none">{getPlantEmoji(plant)}</span>
              {plant.name}
            </h1>
            <p className="text-sm text-sage-500 truncate">{plant.species} · {plant.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <DeviceChip deviceId={plant.device_id} status={deviceStatus} />
          <button onClick={() => setEditOpen(true)} className="btn-secondary px-2.5 sm:px-3 py-2 sm:py-2.5" title="Upraviť rastlinu">
            <PencilLine className="w-4 h-4" />
            <span className="hidden sm:inline">Upraviť</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 sm:p-2.5 rounded-xl text-sage-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Odstrániť rastlinu"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Mobile device status */}
      <div className="md:hidden flex items-center gap-2 text-xs text-sage-500">
        <span className="font-mono">{plant.device_id || 'Bez zariadenia'}</span>
        <span className="text-sage-300">·</span>
        <MobileStatusBadge status={deviceStatus} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {METRICS.map(m => {
          const val = r[m.key];
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`card p-4 text-left transition-all ${active ? 'ring-2 ring-green-400/40 border-green-200' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="w-4 h-4" style={{ color: m.color }} />
                <span className="text-xs text-sage-500">{m.label}</span>
              </div>
              <p className="text-xl font-bold text-green-900">
                {val != null ? Math.round(val * 10) / 10 : '—'}
                <span className="text-sm font-normal text-sage-400">{m.unit}</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${activeMetric.color}14` }}>
              <activeMetric.icon className="w-4 h-4" style={{ color: activeMetric.color }} />
            </div>
            <h2 className="font-semibold text-green-900">{activeMetric.label}</h2>
          </div>
          <div className="flex gap-0.5 bg-sage-50 rounded-xl p-1">
            {[6, 12, 24, 48].map(h => (
              <button
                key={h}
                onClick={() => handleHoursChange(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  hours === h
                    ? 'bg-white text-green-700 shadow-sm ring-1 ring-sage-100'
                    : 'text-sage-400 hover:text-sage-600'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div
          ref={chartContainerRef}
          className={`relative px-2 sm:px-3 pb-4 ${zoomDomain ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
        >
          {/* Jemný loading overlay pri prepínaní hodín */}
          {chartLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl transition-opacity duration-200">
              <div className="w-5 h-5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
            </div>
          )}

          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-sage-400">
              Žiadne dáta pre zvolený interval
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <defs>
                    <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.20} />
                      <stop offset="50%" stopColor={activeMetric.color} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#eef1ea" vertical={false} />

                  {/* Offline zóny - červenkavý pás */}
                  {offlineZones.map((zone, i) => (
                    <ReferenceArea
                      key={`offline-${i}`}
                      x1={zone.x1}
                      x2={zone.x2}
                      fill="#fef2f2"
                      fillOpacity={0.7}
                      stroke="#fecaca"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      ifOverflow="hidden"
                    />
                  ))}

                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={zoomDomain ? [zoomDomain.x1, zoomDomain.x2] : [ticks[0], ticks[ticks.length - 1]]}
                    ticks={zoomDomain
                      ? generateTicks(zoomDomain.x1, zoomDomain.x2, zoomDomain.x2 - zoomDomain.x1 > 12 * 3600000 ? 48 : hours)
                      : ticks
                    }
                    tickFormatter={(ts) => formatTickTime(ts, zoomDomain
                      ? (zoomDomain.x2 - zoomDomain.x1 > 24 * 3600000 ? 48 : 6)
                      : hours
                    )}
                    tick={{ fontSize: 11, fill: '#a3af96', fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: '#eef1ea', strokeWidth: 1 }}
                    tickMargin={10}
                    height={hours >= 48 && !zoomDomain ? 48 : 36}
                    padding={{ left: 4, right: 4 }}
                    allowDataOverflow={true}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#889978', fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={44}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    labelFormatter={(ts) => {
                      if (!ts) return '';
                      return formatTooltipLabel(ts);
                    }}
                    formatter={(value, name, props) => {
                      if (props?.payload?.offline) return ['Zariadenie offline', ''];
                      return [Math.round(value * 10) / 10 + activeMetric.unit, activeMetric.label];
                    }}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(8px)',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                      padding: '10px 14px'
                    }}
                    labelStyle={{ color: '#3c4435', fontWeight: 700, marginBottom: 4, fontSize: '11px' }}
                    itemStyle={{ color: '#566349', padding: 0 }}
                    cursor={{ stroke: activeMetric.color, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={activeMetric.color}
                    fill={`url(#grad-${metric})`}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: activeMetric.color }}
                    isAnimationActive={true}
                    animationDuration={500}
                    animationEasing="ease-out"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Legenda offline zón */}
              <div className="flex items-center justify-between px-3 mt-1">
                <div className="flex items-center gap-3">
                  {offlineZones.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-sage-400">
                      <span className="inline-block w-3 h-2 rounded-sm bg-red-50 border border-red-200" />
                      Zariadenie offline
                    </div>
                  )}
                  <span className="text-[10px] text-sage-300">Koliesko myši = zoom</span>
                </div>
                <div className="text-[11px] sm:text-xs text-sage-400">
                  Aktualizované: <span className="font-medium text-sage-500">{formatUpdatedAt(r.created_at)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleWater} className="btn-secondary">
          <Droplet className="w-4 h-4" /> Zaznamenať polievanie
        </button>
        <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary disabled:opacity-50">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {analyzing ? 'Analyzujem...' : 'AI Analýza'}
        </button>
      </div>

      {analysis && (
        <div className="card p-5 fade-in">
          <div className="flex items-center gap-4 mb-4">
            <GaugeRing
              value={analysis.health_score || 0}
              size={56}
              strokeWidth={4}
              color={(analysis.health_score || 0) >= 70 ? '#22c55e' : (analysis.health_score || 0) >= 40 ? '#eab308' : '#ef4444'}
            >
              <span className="text-sm font-bold">{analysis.health_score}</span>
            </GaugeRing>
            <div>
              <h3 className="font-semibold text-green-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-green-500" /> AI Analýza
                {aiSuccess ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </h3>
              <p className="text-xs text-sage-400 flex items-center gap-1">
                {aiProvider}
                {aiSuccess ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[10px] font-semibold">OK</span>
                ) : (
                  <span className="inline-flex px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] font-semibold">OFFLINE</span>
                )}
              </p>
            </div>
            {analysis.watering_needed && (
              <span className="ml-auto px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold flex items-center gap-1">
                <Droplet className="w-3 h-3" /> Treba poliať
              </span>
            )}
          </div>

          <p className="text-sm text-sage-600 mb-4">{analysis.summary}</p>

          {analysis.recommendations?.length > 0 && (
            <div className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-sage-50">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    rec.priority === 'high' ? 'bg-red-400' : rec.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-green-900">{rec.action}</p>
                    <p className="text-xs text-sage-500 mt-0.5">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {waterLog.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-green-900 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-sage-400" /> História polievania
          </h3>
          <div className="space-y-2">
            {waterLog.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-sage-50">
                <span className="text-green-900">{new Date(w.created_at).toLocaleString('sk')}</span>
                <span className="text-sage-400">{w.amount_ml ? `${w.amount_ml} ml` : ''} {w.notes || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PlantEditModal
        isOpen={editOpen}
        plant={plant}
        onClose={() => setEditOpen(false)}
        onSaved={(updatedPlant) => {
          setPlant(updatedPlant);
        }}
      />
    </div>
  );
}

function DeviceChip({ deviceId, status }) {
  const isOnline = status?.isOnline;
  const dotClass = isOnline ? 'bg-green-500' : 'bg-red-400';
  const labelClass = isOnline ? 'text-green-600' : 'text-red-500';
  const label = isOnline ? 'Online' : 'Offline';

  return (
    <div className="hidden md:flex items-center gap-2 rounded-2xl border border-sage-100 bg-white px-3 py-2 min-w-0">
      <span className="truncate text-xs text-sage-500">{deviceId || 'Bez zariadenia'}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${labelClass}`}>
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
        </span>
        {label}
      </span>
    </div>
  );
}

function MobileStatusBadge({ status }) {
  if (status?.isOnline) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-green-600">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-red-500">
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
      Offline
    </span>
  );
}
