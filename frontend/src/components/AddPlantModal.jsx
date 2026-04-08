import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Save, Loader2, Sparkles, Wifi, WifiOff, Check } from 'lucide-react';
import { createPlant, suggestThresholds, getAvailableDevices } from '../services/api';

const INITIAL_FORM = {
  name: '', species: '', device_id: '', location: '', emoji: '',
  min_soil_moisture: 30, max_soil_moisture: 80,
  min_temperature: 15, max_temperature: 30, min_light: 200
};

export default function AddPlantModal({ open, onClose }) {
  const navigate = useNavigate();
  const overlayRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState({ available: [], assigned: [] });
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_FORM });

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM });
    setSaving(false);
    setAiLoading(false);
    setAiDescription('');
    setError('');
    setClosing(false);
  }, []);

  useEffect(() => {
    if (open) {
      resetForm();
      loadDevices();
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, resetForm]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) handleClose();
  }

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const data = await getAvailableDevices();
      setDevices(data);
      if (data.available?.length > 0) {
        setForm(f => ({ ...f, device_id: data.available[0] }));
      }
    } catch {
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
    } catch { setError('AI odporúčanie zlyhalo.'); }
    setAiLoading(false);
  }

  async function submit() {
    if (!form.name.trim()) { setError('Názov rastliny je povinný.'); return; }
    if (!form.device_id) { setError('Vyber IoT zariadenie.'); return; }
    setSaving(true); setError('');
    try {
      const p = await createPlant(form);
      handleClose();
      navigate(`/plant/${p.id}`);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Chyba pri ukladaní — skontroluj či backend beží.';
      setError(msg);
      setSaving(false);
    }
  }

  if (!open) return null;
  const hasAvailable = devices.available?.length > 0;
  const hasAny = hasAvailable || devices.assigned?.length > 0;

  return (
    <div ref={overlayRef} onClick={handleOverlayClick}
      className={`fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-4 py-8 sm:py-12
        transition-all duration-250
        ${closing ? 'bg-black/0' : 'bg-black/40 dark:bg-black/60 backdrop-blur-sm'}`}>

      <div className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl
        bg-white dark:bg-[#111] border border-sage-200/60 dark:border-green-900/30
        shadow-2xl dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]
        transition-all duration-250
        ${closing ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}
        style={{ animation: closing ? 'none' : 'modalIn 0.3s cubic-bezier(0.22,1,0.36,1)' }}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-sage-100 dark:border-green-900/20
          bg-white/90 dark:bg-[#111]/90 backdrop-blur-md rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-green-900 dark:text-green-100">Pridať rastlinu</h2>
            <p className="text-xs text-sage-400 dark:text-green-700 mt-0.5">Pripoj ESP32 senzor</p>
          </div>
          <button onClick={handleClose}
            className="p-2 -mr-1 rounded-xl hover:bg-sage-50 dark:hover:bg-green-950/40 transition-all active:scale-90">
            <X className="w-5 h-5 text-sage-400 dark:text-green-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/20 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">Názov rastliny *</label>
            <input name="name" value={form.name} onChange={set} placeholder="napr. Moja Monstera" className="input-field" autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">Druh *</label>
              <input name="species" value={form.species} onChange={set} placeholder="Monstera deliciosa" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">Umiestnenie</label>
              <input name="location" value={form.location} onChange={set} placeholder="Obývačka" className="input-field" />
            </div>
          </div>

          {/* Device */}
          <div>
            <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">IoT zariadenie *</label>
            {devicesLoading ? (
              <div className="input-field flex items-center gap-2 text-sage-400 dark:text-green-700">
                <Loader2 className="w-4 h-4 animate-spin" /> Načítavam...
              </div>
            ) : hasAny ? (
              <div className="space-y-2">
                <select name="device_id" value={form.device_id} onChange={set} className="input-field cursor-pointer">
                  {!form.device_id && <option value="">— Vyber zariadenie —</option>}
                  {hasAvailable && (
                    <optgroup label="Dostupné">
                      {devices.available.map(id => <option key={id} value={id}>{id}</option>)}
                    </optgroup>
                  )}
                  {devices.assigned?.length > 0 && (
                    <optgroup label="Obsadené">
                      {devices.assigned.map(id => <option key={id} value={id} disabled>{id} — obsadené</option>)}
                    </optgroup>
                  )}
                </select>
                <div className="flex items-center gap-2 text-xs">
                  {hasAvailable
                    ? <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-500">{devices.available.length} voľných</span></>
                    : <><WifiOff className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">Žiadne voľné</span></>
                  }
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input name="device_id" value={form.device_id} onChange={set} placeholder="esp32-001" className="input-field font-mono" />
                <p className="text-xs text-sage-400 dark:text-green-700">Zadaj ID zariadenia manuálne — žiadne sa nenašli v systéme.</p>
              </div>
            )}
          </div>

          <hr className="border-sage-100 dark:border-green-900/20" />

          {/* AI + Thresholds */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-sage-500 dark:text-green-700">Prahové hodnoty</p>
            <button onClick={handleAISuggest} disabled={aiLoading || !form.species}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 disabled:opacity-40">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Analyzujem...' : 'AI doplnenie'}
            </button>
          </div>

          {aiDescription && (
            <div className="px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-xs text-purple-700 dark:text-purple-400 leading-relaxed flex items-start gap-2">
              <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{form.emoji && <span className="text-base mr-1">{form.emoji}</span>}{aiDescription}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-sage-400 dark:text-green-700 mb-1">Min. vlhkosť (%)</label>
              <input name="min_soil_moisture" type="number" value={form.min_soil_moisture} onChange={set} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-sage-400 dark:text-green-700 mb-1">Max. vlhkosť (%)</label>
              <input name="max_soil_moisture" type="number" value={form.max_soil_moisture} onChange={set} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-sage-400 dark:text-green-700 mb-1">Min. teplota (°C)</label>
              <input name="min_temperature" type="number" value={form.min_temperature} onChange={set} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-sage-400 dark:text-green-700 mb-1">Max. teplota (°C)</label>
              <input name="max_temperature" type="number" value={form.max_temperature} onChange={set} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-sage-400 dark:text-green-700 mb-1">Min. svetlo (lux)</label>
            <input name="min_light" type="number" value={form.min_light} onChange={set} className="input-field" />
          </div>

          <button onClick={submit} disabled={saving || (!hasAvailable && !form.device_id)}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Ukladám...' : 'Uložiť'}
          </button>
        </div>
      </div>
    </div>
  );
}
