import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Battery,
  ChevronRight,
  Droplets,
  Home,
  Leaf,
  Menu,
  Plus,
  Sparkles,
  Sun,
  Thermometer,
  Wifi,
  Wind,
  Zap
} from 'lucide-react';
import { getDashboardOverview } from '../services/api';
import AddPlantModal from './AddPlantModal';
import { getDeviceStatus, isDeviceOnline, normalizeDeviceStatus } from '../utils/deviceStatus';
import { getPlantEmoji } from '../utils/plantEmoji';

const REFRESH_INTERVAL_MS = 20000;
const DESIGN_STORAGE_KEY = 'smartpot-dashboard-design';

const DESIGN_OPTIONS = [
  { id: 'premium', label: 'Premium iOS', description: 'detailný, moderný, najviac profi' },
  { id: 'clean', label: 'Clean Plant', description: 'svetlý dashboard s kartami' },
  { id: 'dark', label: 'Dark Minimal', description: 'tmavý IoT štýl' },
  { id: 'ultra', label: 'Ultra Minimal', description: 'čistý textový prehľad' }
];

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [design, setDesign] = useState(() => localStorage.getItem(DESIGN_STORAGE_KEY) || 'premium');
  const [selectedPlantId, setSelectedPlantId] = useState(null);

  useEffect(() => {
    localStorage.setItem(DESIGN_STORAGE_KEY, design);
  }, [design]);

  useEffect(() => {
    let mounted = true;

    const load = async ({ silent = false } = {}) => {
      try {
        const d = await getDashboardOverview();
        if (!mounted) return;
        setData(d || []);
      } catch {
        if (!mounted || silent) return;
        setData([]);
      } finally {
        if (mounted && !silent) setLoading(false);
      }
    };

    load();

    const interval = window.setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedPlantId && data[0]?.plant?.id) setSelectedPlantId(data[0].plant.id);
  }, [data, selectedPlantId]);

  const models = useMemo(() => data.map(toPlantViewModel), [data]);
  const selectedPlant = models.find(item => item.id === selectedPlantId) || models[0] || null;
  const summary = useMemo(() => getSummary(models), [models]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-200 dark:border-green-800/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 page-shell">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between section-reveal stagger-1">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
            <Sparkles className="h-3.5 w-3.5" /> Minimalistický frontend
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-sage-900 dark:text-green-100">SmartPot</h1>
          <p className="mt-1 text-sm text-sage-500 dark:text-green-700">Vyber si dizajn a otestuj ho na živých dátach zo senzorov.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DesignSwitcher value={design} onChange={setDesign} />
          <button onClick={() => setShowAddModal(true)} className="btn-primary justify-center">
            <Plus className="w-4 h-4" /> Pridať rastlinu
          </button>
        </div>
      </div>

      <AddPlantModal open={showAddModal} onClose={() => { setShowAddModal(false); setRefreshKey(k => k + 1); }} />

      {models.length === 0 ? (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      ) : (
        <>
          {design === 'premium' && <PremiumDesign plants={models} selectedPlant={selectedPlant} onSelect={setSelectedPlantId} summary={summary} />}
          {design === 'clean' && <CleanPlantDesign plants={models} summary={summary} />}
          {design === 'dark' && <DarkMinimalDesign plants={models} summary={summary} onAdd={() => setShowAddModal(true)} />}
          {design === 'ultra' && <UltraMinimalDesign plants={models} />}
        </>
      )}
    </div>
  );
}

function DesignSwitcher({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-sage-100 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-green-900/30 dark:bg-[#111]/80 sm:flex">
      {DESIGN_OPTIONS.map(option => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.description}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${active
              ? 'bg-green-600 text-white shadow-sm shadow-green-600/20'
              : 'text-sage-500 hover:bg-sage-50 hover:text-green-700 dark:text-green-700 dark:hover:bg-green-950/40 dark:hover:text-green-400'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-green-200 bg-white/80 px-6 py-16 text-center shadow-sm dark:border-green-900/30 dark:bg-[#101510]/70">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
        <Leaf className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-sage-900 dark:text-green-100">Zatiaľ žiadne rastliny</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-sage-500 dark:text-green-700">Pridaj prvú rastlinu a SmartPot začne zobrazovať živé hodnoty zo senzora.</p>
      <button onClick={onAdd} className="btn-primary mx-auto mt-6">
        <Plus className="h-4 w-4" /> Pridať rastlinu
      </button>
    </div>
  );
}

function PremiumDesign({ plants, selectedPlant, onSelect, summary }) {
  const active = selectedPlant || plants[0];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-sage-100 bg-[#f4f3ee] shadow-[0_18px_60px_rgba(60,68,53,0.10)] section-reveal stagger-2 dark:border-green-900/20 dark:bg-[#0c0f0c]">
      <div className="grid min-h-[680px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-white/70 bg-white/72 p-5 backdrop-blur-xl dark:border-green-900/20 dark:bg-[#101510]/90 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-sage-900 dark:text-green-100">SmartPot</p>
              <p className="text-xs text-sage-400 dark:text-green-700">Premium iOS style</p>
            </div>
          </div>

          <div className="mt-7 grid gap-2">
            <SidebarItem active icon={Leaf} label="Moje rastliny" />
            <SidebarItem icon={Activity} label="Dashboard" />
            <SidebarItem icon={AlertCircle} label="Alerty" badge={summary.needsAttention} />
          </div>

          <div className="mt-8 border-t border-sage-100 pt-5 dark:border-green-900/20">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-sage-400 dark:text-green-700">Plants</p>
            <div className="space-y-2">
              {plants.map(plant => (
                <button
                  key={plant.id}
                  onClick={() => onSelect(plant.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all ${plant.id === active?.id
                    ? 'bg-green-50 text-sage-900 shadow-sm dark:bg-green-950/40 dark:text-green-100'
                    : 'text-sage-600 hover:bg-white/70 dark:text-green-700 dark:hover:bg-green-950/30'
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm dark:bg-[#151b15]">{plant.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{plant.name}</span>
                    <span className="block truncate text-xs text-sage-400 dark:text-green-700">{plant.location || plant.species || 'Bez lokácie'}</span>
                  </span>
                  <span className={`h-2 w-2 rounded-full ${plant.online ? 'bg-green-500' : 'bg-red-400'}`} />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="p-5 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sage-400 dark:text-green-700">Vybraná rastlina</p>
              <h2 className="mt-1 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-green-100">{active.name}</h2>
            </div>
            <Link to={`/plant/${active.id}`} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-green-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#151b15] dark:text-green-400">
              Detail <ChevronRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#e8e2d2] via-[#f5f1e7] to-[#dfe8d7] p-8 shadow-[0_20px_55px_rgba(60,68,53,0.12)] dark:from-[#182118] dark:via-[#0f130f] dark:to-[#172017]">
              <div className="absolute right-8 top-8 h-28 w-28 rounded-full bg-white/50 blur-2xl dark:bg-green-400/10" />
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <span className="select-none text-[11rem] leading-none drop-shadow-sm">{active.emoji}</span>
                <div className="mt-4 rounded-3xl bg-white/80 px-5 py-3 shadow-sm backdrop-blur dark:bg-black/30">
                  <p className="text-sm font-semibold text-sage-900 dark:text-green-100">{active.species || 'Smart plant'}</p>
                  <p className="mt-1 text-xs text-sage-500 dark:text-green-700">{active.location || 'Bez lokácie'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-sm text-sage-500 dark:text-green-700">
                <span className="inline-flex items-center gap-2"><Home className="h-4 w-4" /> {active.location || 'Bez lokácie'}</span>
                <span className="h-4 w-px bg-sage-200 dark:bg-green-900/30" />
                <StatusPill online={active.online} label={active.online ? 'Online' : 'Offline'} />
                <span className="h-4 w-px bg-sage-200 dark:bg-green-900/30" />
                <span>Update: {active.updatedLabel}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PremiumMetric icon={Droplets} label="Moisture" value={active.moistureText} progress={active.soil_moisture} />
                <PremiumMetric icon={Thermometer} label="Temperature" value={active.temperatureText} sparkline />
                <PremiumMetric icon={Wind} label="Humidity" value={active.humidityText} progress={active.humidity} />
                <PremiumMetric icon={Sun} label="Light" value={active.lightText} rating={active.lightRating} />
              </div>

              <div className="rounded-[1.75rem] bg-white p-5 shadow-sm dark:bg-[#111611]">
                <p className="text-lg font-semibold text-sage-900 dark:text-green-100">Device</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50 text-sage-500 dark:bg-green-950/40 dark:text-green-600">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-sage-400 dark:text-green-700">Device ID</p>
                      <p className="truncate font-semibold text-sage-900 dark:text-green-100">{active.deviceId || 'Nepriradené'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-sage-100 dark:border-green-900/20 sm:border-l sm:pl-5">
                    <Battery className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="text-xs text-sage-400 dark:text-green-700">Health score</p>
                      <p className="font-semibold text-sage-900 dark:text-green-100">{active.score || 0}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-sage-600 shadow-sm dark:bg-green-950/20 dark:text-green-700">
                🌿 Tip: {active.name} vyzerá najlepšie v prehľadnom detailnom dizajne.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, badge }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold ${active ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'text-sage-500 dark:text-green-700'}`}>
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {badge > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600">{badge}</span>}
    </div>
  );
}

function PremiumMetric({ icon: Icon, label, value, progress, sparkline, rating }) {
  return (
    <div className="min-h-[152px] rounded-[1.75rem] bg-white p-5 shadow-sm dark:bg-[#111611]">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm text-sage-500 dark:text-green-700">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-green-100">{value}</p>
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-green-950/50">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sparkline && <TinySparkline className="mt-5" />}
      {rating && (
        <div className="mt-5 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < rating ? 'bg-green-500' : 'bg-sage-200 dark:bg-green-950/70'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function CleanPlantDesign({ plants, summary }) {
  return (
    <div className="rounded-[2rem] border border-sage-100 bg-white/90 p-5 shadow-[0_18px_60px_rgba(60,68,53,0.08)] section-reveal stagger-2 dark:border-green-900/20 dark:bg-[#101510]/90 sm:p-8">
      <div className="flex flex-col gap-4 border-b border-sage-100 pb-6 dark:border-green-900/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400">
            <Leaf className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-sage-900 dark:text-green-100">SmartPot</h2>
            <p className="text-sm text-sage-500 dark:text-green-700">Clean Plant Dashboard</p>
          </div>
        </div>
        <Link to="/add" className="btn-primary justify-center"><Plus className="h-4 w-4" /> Add plant</Link>
      </div>

      <div className="my-6 grid gap-3 rounded-3xl border border-sage-100 p-4 dark:border-green-900/20 sm:grid-cols-3">
        <SummaryStat icon={Wifi} value={summary.online} label="online" tone="green" />
        <SummaryStat icon={AlertCircle} value={summary.needsAttention} label="needs attention" tone="red" />
        <SummaryStat icon={Leaf} value={summary.total} label="total plants" tone="sage" />
      </div>

      <h3 className="mb-5 text-2xl font-semibold text-sage-900 dark:text-green-100">Your plants</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        {plants.map(plant => <CleanPlantCard key={plant.id} plant={plant} />)}
      </div>
    </div>
  );
}

function CleanPlantCard({ plant }) {
  return (
    <Link to={`/plant/${plant.id}`} className="group overflow-hidden rounded-3xl border border-sage-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-green-900/20 dark:bg-[#111611]">
      <div className="grid sm:grid-cols-[170px_minmax(0,1fr)]">
        <div className="flex min-h-[190px] items-center justify-center bg-gradient-to-br from-green-50 to-sage-50 text-8xl dark:from-green-950/40 dark:to-[#0f130f]">
          {plant.emoji}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h4 className="truncate text-2xl font-semibold text-sage-900 dark:text-green-100">{plant.name}</h4>
              <p className="mt-1 text-sm text-sage-500 dark:text-green-700">{plant.location || plant.species || 'Bez lokácie'}</p>
            </div>
            <StatusPill online={plant.online} label={plant.online ? 'Online' : 'Offline'} />
          </div>
          <p className="mt-5 text-sm text-sage-400 dark:text-green-700">{plant.updatedLabel}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-sage-100 pt-4 dark:border-green-900/20">
            <MiniMetric icon={Droplets} label="Moisture" value={plant.moistureText} hint={plant.moistureHint} warn={plant.soil_moisture < 25} />
            <MiniMetric icon={Thermometer} label="Temperature" value={plant.temperatureText} hint="Comfortable" />
            <MiniMetric icon={Wind} label="Humidity" value={plant.humidityText} hint={plant.humidityHint} warn={plant.humidity < 35} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function DarkMinimalDesign({ plants, summary, onAdd }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#050b0b] text-white shadow-[0_20px_70px_rgba(0,0,0,0.25)] section-reveal stagger-2">
      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="text-green-400"><Leaf className="h-9 w-9" /></div>
            <h2 className="text-2xl font-semibold">SmartPot</h2>
          </div>
          <nav className="mt-10 space-y-3 text-sm">
            <DarkNav active icon={Activity} label="Overview" />
            <DarkNav icon={Wifi} label="Devices" />
            <DarkNav icon={AlertCircle} label="Alerts" />
          </nav>
          <div className="mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center gap-2 font-semibold text-green-400"><Droplets className="h-4 w-4" /> Care Tip</p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{plants[0]?.name || 'Rastlina'} vyzerá dobre. Sleduj hlavne vlhkosť pôdy.</p>
          </div>
        </aside>

        <main>
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2 text-sm text-white/70"><span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.75)]" /> {summary.online} devices online</p>
            <button onClick={onAdd} className="rounded-xl border border-green-400/30 px-4 py-2 text-sm font-semibold text-green-400 transition hover:bg-green-400/10"><Plus className="mr-2 inline h-4 w-4" /> Add Device</button>
          </div>
          <div className="p-6">
            <h3 className="text-3xl font-semibold">Good evening</h3>
            <p className="mt-2 text-white/60">Here’s how your plants are doing.</p>
            <div className="mt-7 grid gap-5 xl:grid-cols-2">
              {plants.map(plant => <DarkPlantCard key={plant.id} plant={plant} />)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function DarkNav({ icon: Icon, label, active }) {
  return <div className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${active ? 'bg-green-400/10 text-green-400' : 'text-white/65'}`}><Icon className="h-5 w-5" /> {label}</div>;
}

function DarkPlantCard({ plant }) {
  return (
    <Link to={`/plant/${plant.id}`} className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-green-400/30 sm:grid-cols-[160px_minmax(0,1fr)]">
      <div className="flex items-center justify-center rounded-3xl bg-black/30 text-8xl">{plant.emoji}</div>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-2xl font-semibold">{plant.name}</h4>
            <div className="mt-2"><StatusPill online={plant.online} label={plant.online ? 'Online' : 'Offline'} dark /></div>
          </div>
          <Menu className="h-5 w-5 text-white/40" />
        </div>
        <div className="mt-4 space-y-3">
          <DarkMetric icon={Droplets} label="Moisture" value={plant.moistureText} muted={!plant.online} />
          <DarkMetric icon={Thermometer} label="Temperature" value={plant.temperatureText} muted={!plant.online} />
        </div>
      </div>
    </Link>
  );
}

function DarkMetric({ icon: Icon, label, value, muted }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs text-white/55"><Icon className="h-4 w-4" /> {label}</p>
          <p className={`mt-1 text-3xl font-semibold ${muted ? 'text-white/70' : 'text-green-400'}`}>{value}</p>
        </div>
        <TinySparkline muted={muted} />
      </div>
    </div>
  );
}

function UltraMinimalDesign({ plants }) {
  return (
    <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm section-reveal stagger-2 dark:border-neutral-800 dark:bg-[#0f0f0f] sm:p-10">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-8 dark:border-neutral-800">
        <h2 className="text-4xl font-medium tracking-tight text-black dark:text-white">SmartPot</h2>
        <Menu className="h-6 w-6 text-black dark:text-white" />
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {plants.map(plant => (
          <Link key={plant.id} to={`/plant/${plant.id}`} className="block py-9 transition hover:opacity-70">
            <h3 className="text-3xl font-medium text-black dark:text-white">{plant.name}</h3>
            <p className="mt-3 flex items-center gap-2 text-lg text-neutral-500">
              <span className={`h-2.5 w-2.5 rounded-full ${plant.online ? 'bg-green-500' : 'bg-red-400'}`} />
              {plant.online ? 'Online' : 'Offline'} · {plant.updatedLabel}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-5">
              <UltraMetric label="MOISTURE" value={plant.moistureText} />
              <UltraMetric label="TEMPERATURE" value={plant.temperatureText} />
              <UltraMetric label="HUMIDITY" value={plant.humidityText} />
              <UltraMetric label="LIGHT" value={plant.lightText} />
              <UltraMetric label="SCORE" value={`${plant.score || 0}%`} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ icon: Icon, value, label, tone }) {
  const toneClass = tone === 'green'
    ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
    : tone === 'red'
      ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
      : 'bg-sage-50 text-sage-700 dark:bg-green-950/30 dark:text-green-700';

  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}><Icon className="h-6 w-6" /></div>
      <div>
        <p className="text-2xl font-semibold text-sage-900 dark:text-green-100">{value}</p>
        <p className="text-sm text-sage-500 dark:text-green-700">{label}</p>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, hint, warn }) {
  return (
    <div className="border-r border-sage-100 pr-3 last:border-r-0 dark:border-green-900/20">
      <p className="flex items-center gap-1.5 text-[11px] text-sage-500 dark:text-green-700"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="mt-2 text-lg font-semibold text-sage-900 dark:text-green-100">{value}</p>
      <p className={`mt-1 text-xs ${warn ? 'text-red-500' : 'text-green-600 dark:text-green-500'}`}>{hint}</p>
    </div>
  );
}

function UltraMetric({ label, value }) {
  return (
    <div className="border-neutral-200 dark:border-neutral-800 sm:border-r sm:pr-6 sm:last:border-r-0">
      <p className="text-xs font-semibold tracking-wide text-neutral-500">{label}</p>
      <p className="mt-3 text-2xl font-medium text-black dark:text-white">{value}</p>
    </div>
  );
}

function StatusPill({ online, label, dark }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${online
      ? dark ? 'border border-green-400/30 bg-green-400/10 text-green-400' : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
      : dark ? 'border border-white/15 bg-white/5 text-white/60' : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
    }`}>
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

function TinySparkline({ className = '', muted = false }) {
  const stroke = muted ? 'rgba(255,255,255,0.48)' : '#4ade80';
  return (
    <svg viewBox="0 0 160 44" className={`h-12 w-full ${className}`} fill="none" aria-hidden="true">
      <path d="M4 30 C18 18 25 30 37 22 C49 14 57 32 70 24 C84 15 95 12 108 20 C122 29 132 14 156 18" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <circle cx="156" cy="18" r="4" fill={stroke} />
    </svg>
  );
}

function toPlantViewModel(item) {
  const plant = item.plant || {};
  const reading = item.latest_reading || {};
  const analysis = item.latest_analysis || {};
  const status = item.latest_reading ? getDeviceStatus(item.latest_reading) : normalizeDeviceStatus(item.device_status);
  const online = isDeviceOnline(status);
  const score = Math.round(analysis.health_score || 0);
  const soil = numberOrNull(reading.soil_moisture);
  const temp = numberOrNull(reading.temperature);
  const humidity = numberOrNull(reading.humidity);
  const light = numberOrNull(reading.light_lux);

  return {
    id: plant.id,
    name: plant.name || 'Rastlina',
    species: plant.species || '',
    location: plant.location || '',
    deviceId: plant.device_id,
    emoji: getPlantEmoji(plant),
    online,
    status,
    score,
    unreadAlerts: item.unread_alerts || 0,
    updatedLabel: status?.compactLabel || status?.relativeLabel || 'bez dát',
    soil_moisture: soil,
    temperature: temp,
    humidity,
    light_lux: light,
    moistureText: formatValue(soil, '%'),
    temperatureText: formatValue(temp, '°C'),
    humidityText: formatValue(humidity, '%'),
    lightText: light == null ? '—' : light > 600 ? 'Good' : light > 200 ? 'OK' : 'Low',
    lightRating: light == null ? 0 : light > 1000 ? 5 : light > 600 ? 4 : light > 250 ? 3 : light > 100 ? 2 : 1,
    moistureHint: soil == null ? 'No data' : soil < 25 ? 'Low' : soil > 75 ? 'High' : 'Good',
    humidityHint: humidity == null ? 'No data' : humidity < 35 ? 'Low' : humidity > 75 ? 'High' : 'Good'
  };
}

function getSummary(plants) {
  const online = plants.filter(p => p.online).length;
  const needsAttention = plants.filter(p => !p.online || p.unreadAlerts > 0 || (p.score > 0 && p.score < 55) || (typeof p.soil_moisture === 'number' && p.soil_moisture < 25)).length;
  return { total: plants.length, online, needsAttention };
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatValue(value, unit) {
  if (value == null) return '—';
  return `${Math.round(value * 10) / 10}${unit}`;
}
