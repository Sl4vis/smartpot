import React, { useState, useEffect } from 'react';
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getPlant, getSensorHistory, getLatestReading, analyzeHealth, waterPlant, getWateringHistory, getAnalysisHistory, deletePlant } from '../services/api';
import GaugeRing from './GaugeRing';
import PlantEditModal from './PlantEditModal';
import { getDeviceStatus, formatAbsoluteDateTime } from '../utils/deviceStatus';

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
  { key: 'light_lux', label: 'Svetlo', icon: Sun, color: '#f59e0b', unit: ' lux' },
];

function formatTime(isoString, hours) {
  const d = new Date(isoString);
  if (hours >= 48) {
    return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric' }) + ' ' +
           d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
  }
  if (hours >= 24) {
    const isToday = new Date().toDateString() === d.toDateString();
    const prefix = isToday ? '' : d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric' }) + ' ';
    return prefix + d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

function formatTooltipLabel(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

function thinData(data, maxPoints = 60) {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
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
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => { load(); }, [id, hours]);

  async function load() {
    try {
      const p = await getPlant(id);
      setPlant(p);
      const [h, l, w, a] = await Promise.all([
        getSensorHistory(p.device_id, hours),
        getLatestReading(p.device_id),
        getWateringHistory(id).catch(() => []),
        getAnalysisHistory(id, 1).catch(() => [])
      ]);
      setHistory(h || []);
      setLatest(l || p.latest_reading || null);
      setWaterLog(w || []);
      if (a?.length) setAnalysis(a[0]);
    } catch {
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
    }
    setLoading(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try { setAnalysis(await analyzeHealth(id)); }
    catch { alert('AI analýza zlyhala.'); }
    setAnalyzing(false);
  }

  async function handleWater() {
    try {
      await waterPlant(id, { notes: 'Manuálne polievanie' });
      load();
    } catch {}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plant) return null;
  const r = latest || {};
  const activeMetric = METRICS.find(m => m.key === metric);
  const deviceStatus = plant?.device_status || getDeviceStatus(r.created_at);
  const updatedLabel = r.created_at ? formatAbsoluteDateTime(r.created_at) : '—';
  const deviceTone = deviceStatus.isOnline
    ? 'text-green-700'
    : deviceStatus.isOffline
      ? 'text-red-600'
      : 'text-sage-500';

  const thinned = thinData(history);
  const chartData = thinned.map(h => ({
    ...h,
    time: formatTime(h.created_at, hours),
    _raw: h.created_at
  }));

  const aiSuccess = analysis?.ai_success === true ||
    (analysis?.summary && !analysis.summary.includes('lokálne') && !analysis.summary.includes('nedostupná'));
  const aiProvider = analysis?.ai_provider === 'groq' ? 'Groq (Llama 3.3)' :
    analysis?.ai_provider === 'gemini' ? 'Google Gemini' :
    (analysis?.ai_provider === 'fallback' ? 'Lokálna analýza' :
    (aiSuccess ? 'AI' : 'Lokálna analýza'));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-green-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-sage-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-green-900 truncate">{plant.name}</h1>
            <p className="text-sm text-sage-500 truncate">{plant.species} · {plant.location}</p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
          <span className="text-xs text-sage-400">{plant.device_id || 'bez zariadenia'}</span>
          <span className={`text-sm font-semibold ${deviceTone}`}>{deviceStatus.label}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setEditOpen(true)} className="btn-secondary px-3 py-2.5" title="Upraviť rastlinu">
            <PencilLine className="w-4 h-4" />
            <span className="hidden sm:inline">Upraviť</span>
          </button>
          <button onClick={handleDelete}
            className="p-2.5 rounded-xl text-sage-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Odstrániť rastlinu">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="sm:hidden flex items-center justify-between rounded-2xl border border-sage-100 bg-white px-4 py-3">
        <span className="text-xs text-sage-400">{plant.device_id || 'bez zariadenia'}</span>
        <span className={`text-sm font-semibold ${deviceTone}`}>{deviceStatus.label}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {METRICS.map(m => {
          const val = r[m.key];
          const active = metric === m.key;
          return (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`card p-4 text-left transition-all ${active ? 'ring-2 ring-green-400/40 border-green-200' : ''}`}>
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

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="font-semibold text-green-900">{activeMetric.label}</h2>
          <div className="flex gap-1 bg-sage-50 rounded-lg p-1">
            {[6, 12, 24, 48].map(h => (
              <button key={h} onClick={() => setHours(h)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${hours === h ? 'bg-white text-green-700 shadow-sm' : 'text-sage-500 hover:text-green-700'}`}>
                {h}h
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[220px] text-sm text-sage-400">
            Žiadne dáta pre zvolený interval
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaede7" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#a3af96' }} tickLine={false} axisLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 6))} angle={hours >= 48 ? -20 : 0}
                dy={hours >= 48 ? 8 : 0} height={hours >= 48 ? 50 : 30} />
              <YAxis tick={{ fontSize: 11, fill: '#a3af96' }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?._raw) return formatTooltipLabel(payload[0].payload._raw);
                  return '';
                }}
                formatter={(value) => [Math.round(value * 10) / 10, activeMetric.label]}
                contentStyle={{ background: '#fff', border: '1px solid #eaede7', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                labelStyle={{ color: '#566349', fontWeight: 600, marginBottom: 4 }} />
              <Area type="monotone" dataKey={metric} stroke={activeMetric.color}
                fill="url(#grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="mt-3 flex justify-end">
          <p className="text-xs text-sage-400 text-right">
            Aktualizované: <span className="font-medium text-sage-500">{updatedLabel}</span>
          </p>
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
            <GaugeRing value={analysis.health_score || 0} size={56} strokeWidth={4}
              color={(analysis.health_score || 0) >= 70 ? '#22c55e' : (analysis.health_score || 0) >= 40 ? '#eab308' : '#ef4444'}>
              <span className="text-sm font-bold">{analysis.health_score}</span>
            </GaugeRing>
            <div>
              <h3 className="font-semibold text-green-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-green-500" /> AI Analýza
                {aiSuccess ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </h3>
              <p className="text-xs text-sage-400 flex items-center gap-1">
                {aiProvider}
                {aiSuccess
                  ? <span className="inline-flex px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[10px] font-semibold">OK</span>
                  : <span className="inline-flex px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] font-semibold">OFFLINE</span>
                }
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
          load();
        }}
      />
    </div>
  );
}
