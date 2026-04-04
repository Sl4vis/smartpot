import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Droplets,
  Thermometer,
  Sun,
  Wind,
  Plus,
  AlertTriangle,
  ChevronRight,
  Activity,
  WifiOff,
  CircleHelp
} from 'lucide-react';
import { getDashboardOverview } from '../services/api';
import GaugeRing from './GaugeRing';
import { getDeviceStatus } from '../utils/deviceStatus';

const DEMO = [
  {
    plant: { id: 'demo-1', name: 'Monstera', species: 'Monstera deliciosa', device_id: 'esp32-001', location: 'Obývačka', min_soil_moisture: 40, min_light: 300 },
    latest_reading: { soil_moisture: 55, temperature: 22.4, humidity: 58, light_lux: 850, created_at: new Date().toISOString() },
    latest_analysis: { health_score: 85, status: 'ok', summary: 'Rastlina je v poriadku.' },
    unread_alerts: 0
  },
  {
    plant: { id: 'demo-2', name: 'Fikus', species: 'Ficus benjamina', device_id: 'esp32-002', location: 'Spálňa', min_soil_moisture: 35, min_light: 400 },
    latest_reading: { soil_moisture: 28, temperature: 20.1, humidity: 45, light_lux: 320, created_at: new Date(Date.now() - 25 * 60000).toISOString() },
    latest_analysis: { health_score: 42, status: 'warning', summary: 'Treba poliať, pôda je suchá.' },
    unread_alerts: 2
  },
  {
    plant: { id: 'demo-3', name: 'Aloe Vera', species: 'Aloe barbadensis', device_id: 'esp32-003', location: 'Kuchyňa', min_soil_moisture: 20, min_light: 500 },
    latest_reading: null,
    latest_analysis: null,
    unread_alerts: 0
  }
];

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDashboardOverview();
        if (d?.length > 0) {
          setData(d);
        } else {
          setData(DEMO);
          setDemo(true);
        }
      } catch {
        setData(DEMO);
        setDemo(true);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  const deviceSummary = summarizeStatuses(data);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-green-900">Moje rastliny</h1>
          <p className="text-sm text-sage-500 mt-1">{data.length} monitorovaných</p>
        </div>
        <Link to="/add" className="btn-primary">
          <Plus className="w-4 h-4" /> Pridať
        </Link>
      </div>

      {demo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/50 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Demo režim — spusti backend pre reálne dáta
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatusSummaryCard label="Online" value={deviceSummary.online} tone="green" icon={Activity} />
        <StatusSummaryCard label="Offline" value={deviceSummary.offline} tone="red" icon={WifiOff} />
        <StatusSummaryCard label="Bez dát" value={deviceSummary.noData} tone="slate" icon={CircleHelp} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item, i) => (
          <PlantCard key={item.plant.id} data={item} i={i} />
        ))}
      </div>
    </div>
  );
}

function summarizeStatuses(data) {
  return data.reduce((acc, item) => {
    const status = item?.device_status || getDeviceStatus(item?.latest_reading);
    if (status.isNoData) acc.noData += 1;
    else if (status.isOffline) acc.offline += 1;
    else acc.online += 1;
    return acc;
  }, { online: 0, offline: 0, noData: 0 });
}

function StatusSummaryCard({ label, value, tone, icon: Icon }) {
  const tones = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-sage-50 text-sage-600 border-sage-100'
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function PlantCard({ data, i }) {
  const { plant, latest_reading: r, latest_analysis: a, unread_alerts } = data;
  const reading = r || {};
  const analysis = a || {};
  const score = analysis.health_score || 0;
  const status = data?.device_status || getDeviceStatus(reading);

  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  const statusLabel = score >= 70 ? 'V poriadku' : score >= 40 ? 'Pozor' : 'Kritické';
  const statusBg = score >= 70 ? 'bg-green-50 text-green-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';

  const deviceTone = status.isOnline
    ? 'text-green-700'
    : status.isOffline
      ? 'text-red-600'
      : 'text-sage-500';

  return (
    <Link to={`/plant/${plant.id}`}
      className={`card p-5 block fade-in delay-${i + 1} group`}>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <GaugeRing value={score} size={48} strokeWidth={4} color={scoreColor}>
            <span className="text-xs font-bold">{score}</span>
          </GaugeRing>
          <div className="min-w-0">
            <h3 className="font-semibold text-green-900 truncate">{plant.name}</h3>
            <p className="text-xs text-sage-500 truncate">{plant.species}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread_alerts > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center justify-center">
              {unread_alerts}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-sage-300 group-hover:text-green-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBg}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={Droplets} label="Pôda" value={reading.soil_moisture} unit="%" color="#3b82f6"
          warn={reading.soil_moisture < (plant.min_soil_moisture || 30)} />
        <Metric icon={Thermometer} label="Teplota" value={reading.temperature} unit="°C" color="#ef4444" />
        <Metric icon={Wind} label="Vzduch" value={reading.humidity} unit="%" color="#8b5cf6" />
        <Metric icon={Sun} label="Svetlo" value={reading.light_lux} unit=" lx" color="#f59e0b"
          warn={reading.light_lux < (plant.min_light || 200)} />
      </div>

      <div className="mt-4 pt-3 border-t border-sage-100 flex items-center justify-between text-xs gap-3">
        <span className="truncate text-sage-400">{plant.location}</span>
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <span className="truncate text-sage-400">{plant.device_id || 'bez zariadenia'}</span>
          <span className={`font-semibold ${deviceTone}`}>{status.label}</span>
        </div>
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, label, value, unit, color, warn }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${warn ? 'bg-red-50' : 'bg-sage-50'}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[10px] text-sage-400 leading-none mb-0.5">{label}</p>
        <p className={`text-sm font-semibold leading-none ${warn ? 'text-red-600' : 'text-green-900'}`}>
          {value != null ? Math.round(value * 10) / 10 : '—'}{unit}
        </p>
      </div>
    </div>
  );
}
