import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Save, Sparkles, Wifi, WifiOff, X } from 'lucide-react';
import { getAvailableDevices, suggestThresholds, updatePlant } from '../services/api';

function getInitialForm(plant) {
  return {
    name: plant?.name || '',
    species: plant?.species || '',
    device_id: plant?.device_id || '',
    location: plant?.location || '',
    emoji: plant?.emoji || '',
    min_soil_moisture: plant?.min_soil_moisture ?? 30,
    max_soil_moisture: plant?.max_soil_moisture ?? 80,
    min_temperature: plant?.min_temperature ?? 15,
    max_temperature: plant?.max_temperature ?? 30,
    min_light: plant?.min_light ?? 200,
    max_light: plant?.max_light ?? 10000,
    image_url: plant?.image_url || ''
  };
}

export default function PlantEditModal({ isOpen, onClose, plant, onSaved }) {
  const [form, setForm] = useState(getInitialForm(plant));
  const [devices, setDevices] = useState({ available: [], assigned: [], current_device: null });
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !plant) return;
    setForm(getInitialForm(plant));
    setAiDescription('');
    setError('');
    loadDevices(plant);
  }, [isOpen, plant]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  async function loadDevices(currentPlant) {
    setDevicesLoading(true);
    try {
      const data = await getAvailableDevices(currentPlant?.id);
      setDevices(data || { available: [], assigned: [], current_device: currentPlant?.device_id || '' });
      setForm(prev => ({
        ...prev,
        device_id: prev.device_id || data?.current_device || data?.available?.[0] || currentPlant?.device_id || ''
      }));
    } catch {
      setDevices({ available: [], assigned: [], current_device: currentPlant?.device_id || null });
    } finally {
      setDevicesLoading(false);
    }
  }

  function handleFieldChange(e) {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
  }

  async function handleAISuggest() {
    if (!form.species) {
      setError('Najprv vyplň druh rastliny.');
      return;
    }

    setAiLoading(true);
    setError('');
    setAiDescription('');

    try {
      const result = await suggestThresholds(form.species);
      setForm(prev => ({
        ...prev,
        min_soil_moisture: result.min_soil_moisture ?? prev.min_soil_moisture,
        max_soil_moisture: result.max_soil_moisture ?? prev.max_soil_moisture,
        min_temperature: result.min_temperature ?? prev.min_temperature,
        max_temperature: result.max_temperature ?? prev.max_temperature,
        min_light: result.min_light ?? prev.min_light,
        max_light: result.max_light ?? prev.max_light,
        emoji: result.emoji ?? prev.emoji
      }));
      if (result.description) setAiDescription(result.description);
    } catch {
      setError('AI odporúčanie zlyhalo. Skúste neskôr.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!plant?.id) return;
    if (!form.name || !form.device_id) {
      setError('Názov a zariadenie sú povinné.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await updatePlant(plant.id, form);
      onSaved?.(updated);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Chyba pri ukladaní rastliny.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const hasAvailable = useMemo(() => (devices.available?.length || 0) > 0, [devices.available]);
  const hasAny = hasAvailable || (devices.assigned?.length || 0) > 0;

  if (!isOpen || !plant) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-sage-900/35 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden rounded-t-3xl rounded-b-none sm:rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b border-sage-100 bg-white">
          <div>
            <h2 className="text-xl font-bold text-green-900">Upraviť rastlinu</h2>
            <p className="text-sm text-sage-500">Predvyplnené údaje môžeš hneď upraviť.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-sage-400 hover:text-green-700 hover:bg-green-50 transition-colors"
            title="Zavrieť"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(92dvh-76px)] sm:max-h-[calc(90vh-88px)] overscroll-contain">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-green-900 mb-1.5">Názov rastliny *</label>
              <input name="name" value={form.name} onChange={handleFieldChange} placeholder="napr. Moja Monstera" className="input-field" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1.5">Druh *</label>
                <input name="species" value={form.species} onChange={handleFieldChange} placeholder="Monstera deliciosa" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1.5">Umiestnenie</label>
                <input name="location" value={form.location} onChange={handleFieldChange} placeholder="Obývačka" className="input-field" />
              </div>
            </div>

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
                    onChange={handleFieldChange}
                    className="input-field cursor-pointer"
                  >
                    {devices.available?.length > 0 && (
                      <optgroup label="Dostupné zariadenia">
                        {devices.available.map(id => (
                          <option key={id} value={id}>
                            {id}{id === devices.current_device ? ' — aktuálne zariadenie' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {devices.assigned?.length > 0 && (
                      <optgroup label="Obsadené zariadenia">
                        {devices.assigned.map(id => (
                          <option key={id} value={id} disabled>{id} — obsadené</option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {hasAvailable ? (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600">{devices.available.length} dostupných zariadení</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-600">Žiadne voľné zariadenia</span>
                      </>
                    )}
                    {devices.current_device && (
                      <span className="text-sage-400">· aktuálne: {devices.current_device}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    name="device_id"
                    value={form.device_id}
                    onChange={handleFieldChange}
                    placeholder="esp32-001"
                    className="input-field font-mono"
                  />
                  <div className="flex items-center gap-2 text-xs text-sage-400">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Žiadne zariadenia nenájdené — ID môžeš zadať manuálne</span>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-sage-100" />

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-sage-500">Prahové hodnoty</p>
              <button
                type="button"
                onClick={handleAISuggest}
                disabled={aiLoading || !form.species}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title={!form.species ? 'Najprv vyplň druh rastliny' : 'AI doplní optimálne hodnoty'}
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? 'Analyzujem...' : 'AI doplnenie'}
              </button>
            </div>

            {aiDescription && (
              <div className="px-3 py-2.5 rounded-xl bg-purple-50 text-xs text-purple-700 leading-relaxed flex items-start gap-2">
                <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{aiDescription}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-sage-400 mb-1">Min. vlhkosť pôdy (%)</label>
                <input name="min_soil_moisture" type="number" value={form.min_soil_moisture} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-sage-400 mb-1">Max. vlhkosť pôdy (%)</label>
                <input name="max_soil_moisture" type="number" value={form.max_soil_moisture} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-sage-400 mb-1">Min. teplota (°C)</label>
                <input name="min_temperature" type="number" value={form.min_temperature} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-sage-400 mb-1">Max. teplota (°C)</label>
                <input name="max_temperature" type="number" value={form.max_temperature} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-sage-400 mb-1">Min. svetlo (lux)</label>
                <input name="min_light" type="number" value={form.min_light} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-sage-400 mb-1">Max. svetlo (lux)</label>
                <input name="max_light" type="number" value={form.max_light} onChange={handleFieldChange} className="input-field" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-sage-400 mb-1">Obrázok URL (voliteľné)</label>
              <input name="image_url" value={form.image_url} onChange={handleFieldChange} placeholder="https://..." className="input-field" />
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-sage-100 bg-white flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Zrušiť</button>
            <button type="submit" disabled={saving} className="btn-primary justify-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Ukladám...' : 'Uložiť zmeny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
