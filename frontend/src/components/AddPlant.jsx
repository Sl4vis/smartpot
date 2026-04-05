import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Sparkles, Wifi, WifiOff, Check } from 'lucide-react';
import { createPlant, suggestThresholds, getAvailableDevices } from '../services/api';

export default function AddPlant() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [error, setError] = useState('');

  // Zariadenia z DB
  const [devices, setDevices] = useState({ available: [], assigned: [] });
  const [devicesLoading, setDevicesLoading] = useState(true);

  const [form, setForm] = useState({
    name: '', species: '', device_id: '', location: '', emoji: '',
    min_soil_moisture: 30, max_soil_moisture: 80,
    min_temperature: 15, max_temperature: 30, min_light: 200
  });

  // Načítaj zariadenia pri otvorení
  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const data = await getAvailableDevices();
      setDevices(data);
      // Ak je dostupné zariadenie, vyber prvé
      if (data.available?.length > 0 && !form.device_id) {
        setForm(f => ({ ...f, device_id: data.available[0] }));
      }
    } catch {
      // Backend nebeží alebo endpoint neexistuje
      setDevices({ available: [], assigned: [] });
    }
    setDevicesLoading(false);
  }

  function set(e) {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  }

  async function handleAISuggest() {
    if (!form.species) { setError('Najprv vyplň druh rastliny.'); return; }
    setAiLoading(true); setError(''); setAiDescription('');
    try {
      const result = await suggestThresholds(form.species);
      setForm(f => ({
        ...f,
        min_soil_moisture: result.min_soil_moisture ?? f.min_soil_moisture,
        max_soil_moisture: result.max_soil_moisture ?? f.max_soil_moisture,
        min_temperature: result.min_temperature ?? f.min_temperature,
        max_temperature: result.max_temperature ?? f.max_temperature,
        min_light: result.min_light ?? f.min_light,
        emoji: result.emoji ?? f.emoji
      }));
      if (result.description) setAiDescription(result.description);
    } catch {
      setError('AI odporúčanie zlyhalo. Skúste neskôr.');
    }
    setAiLoading(false);
  }

  async function submit() {
    if (!form.name || !form.device_id) { setError('Názov a zariadenie sú povinné.'); return; }
    setSaving(true); setError('');
    try {
      const p = await createPlant(form);
      navigate(`/plant/${p.id}`);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Chyba — skontroluj či backend beží.';
      setError(msg);
      setSaving(false);
    }
  }

  const hasAvailable = devices.available?.length > 0;
  const hasAny = hasAvailable || devices.assigned?.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-green-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-sage-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-green-900">Pridať rastlinu</h1>
          <p className="text-sm text-sage-500">Pripoj ESP32 senzor</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      <div className="card p-6 space-y-5">
        {/* Názov */}
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1.5">Názov rastliny *</label>
          <input name="name" value={form.name} onChange={set} placeholder="napr. Moja Monstera" className="input-field" />
        </div>

        {/* Druh + Umiestnenie */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1.5">Druh *</label>
            <input name="species" value={form.species} onChange={set} placeholder="Monstera deliciosa" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1.5">Umiestnenie</label>
            <input name="location" value={form.location} onChange={set} placeholder="Obývačka" className="input-field" />
          </div>
        </div>

        {/* Zariadenie - dropdown */}
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1.5">IoT zariadenie (ESP32) *</label>

          {devicesLoading ? (
            <div className="input-field flex items-center gap-2 text-sage-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítavam zariadenia...
            </div>
          ) : hasAny ? (
            <div className="space-y-2">
              <select
                name="device_id"
                value={form.device_id}
                onChange={set}
                className="input-field cursor-pointer"
              >
                {/* Dostupné zariadenia */}
                {hasAvailable && (
                  <optgroup label="Dostupné zariadenia">
                    {devices.available.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </optgroup>
                )}

                {/* Priradené - disabled */}
                {devices.assigned?.length > 0 && (
                  <optgroup label="Už priradené (obsadené)">
                    {devices.assigned.map(id => (
                      <option key={id} value={id} disabled>{id} — obsadené</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Status info */}
              <div className="flex items-center gap-2 text-xs">
                {hasAvailable ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-green-600">{devices.available.length} voľných zariadení</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-600">Žiadne voľné zariadenia</span>
                  </>
                )}
                {devices.assigned?.length > 0 && (
                  <span className="text-sage-400">· {devices.assigned.length} obsadených</span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Žiadne zariadenia - umožni manuálne zadanie */}
              <input
                name="device_id"
                value={form.device_id}
                onChange={set}
                placeholder="esp32-001"
                className="input-field font-mono"
              />
              <div className="flex items-center gap-2 text-xs">
                <WifiOff className="w-3.5 h-3.5 text-sage-400" />
                <span className="text-sage-400">Žiadne zariadenia nenájdené — zadaj ID manuálne</span>
              </div>
            </div>
          )}

          <p className="text-xs text-sage-400 mt-1.5">
            Zariadenie sa objaví v zozname keď ESP32 pošle prvé dáta cez Azure IoT Hub
          </p>
        </div>

        <hr className="border-sage-100" />

        {/* AI suggest */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-sage-500">Prahové hodnoty</p>
          <button onClick={handleAISuggest} disabled={aiLoading || !form.species}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!form.species ? 'Najprv vyplň druh rastliny' : 'AI doplní optimálne hodnoty'}>
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? 'Analyzujem...' : 'AI doplnenie'}
          </button>
        </div>

        {aiDescription && (
          <div className="px-3 py-2.5 rounded-xl bg-purple-50 text-xs text-purple-700 leading-relaxed flex items-start gap-2">
            <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {form.emoji && <span className="text-base mr-1">{form.emoji}</span>}
              {aiDescription}
            </span>
          </div>
        )}

        {/* Prahy */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-sage-400 mb-1">Min. vlhkosť pôdy (%)</label>
            <input name="min_soil_moisture" type="number" value={form.min_soil_moisture} onChange={set} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-sage-400 mb-1">Max. vlhkosť pôdy (%)</label>
            <input name="max_soil_moisture" type="number" value={form.max_soil_moisture} onChange={set} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-sage-400 mb-1">Min. teplota (°C)</label>
            <input name="min_temperature" type="number" value={form.min_temperature} onChange={set} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-sage-400 mb-1">Max. teplota (°C)</label>
            <input name="max_temperature" type="number" value={form.max_temperature} onChange={set} className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-sage-400 mb-1">Min. svetlo (lux)</label>
          <input name="min_light" type="number" value={form.min_light} onChange={set} className="input-field" />
        </div>

        <button onClick={submit} disabled={saving || (!hasAvailable && !form.device_id)}
          className="btn-primary w-full justify-center py-3 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Ukladám...' : 'Uložiť'}
        </button>
      </div>
    </div>
  );
}
