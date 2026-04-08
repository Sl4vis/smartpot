import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Save, Loader2, CheckCircle2, AlertCircle, LogOut, Shield, Palette } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';
import { supabase } from '../services/supabaseClient';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
    }
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });

      if (error) throw error;
      setMessage('Profil bol aktualizovaný');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Chyba pri ukladaní');
    }

    setSaving(false);
  }

  async function handleLogout() {
    await signOut();
    navigate('/auth');
  }

  const provider = user?.app_metadata?.provider || 'email';
  const isGoogle = provider === 'google';
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('sk') : '—';

  return (
    <div className="max-w-lg mx-auto space-y-5 page-shell">
      <div>
        <h1 className="text-2xl font-bold text-green-900 dark:text-green-100">Nastavenia</h1>
        <p className="text-sm text-sage-500 dark:text-green-700 mt-1">Spravuj svoj profil a preferencie</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/30 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/20 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Profile card */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3.5 border-b border-sage-100 dark:border-green-900/20 flex items-center gap-2
          bg-sage-50/50 dark:bg-green-950/30">
          <User className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">Profil</span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">Meno</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-300 dark:text-green-800" />
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Tvoje meno" className="input-field pl-10" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-300 dark:text-green-800" />
              <input type="email" value={user?.email || ''} disabled
                className="input-field pl-10 opacity-60 cursor-not-allowed" />
            </div>
            <p className="text-xs text-sage-400 dark:text-green-700 mt-1.5">Email nie je možné zmeniť</p>
          </div>

          <button type="submit" disabled={saving}
            className="btn-primary justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Ukladám...' : 'Uložiť zmeny'}
          </button>
        </form>
      </div>

      {/* Appearance */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3.5 border-b border-sage-100 dark:border-green-900/20 flex items-center gap-2
          bg-sage-50/50 dark:bg-green-950/30">
          <Palette className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">Vzhľad</span>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Tmavý režim</p>
              <p className="text-xs text-sage-400 dark:text-green-700 mt-0.5">Prepni medzi svetlým a tmavým režimom</p>
            </div>
            <button onClick={toggle}
              className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                dark
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.3)]'
                  : 'bg-sage-200'
              }`}>
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${
                dark ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3.5 border-b border-sage-100 dark:border-green-900/20 flex items-center gap-2
          bg-sage-50/50 dark:bg-green-950/30">
          <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">Účet</span>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sage-500 dark:text-green-700">Prihlásenie cez</span>
            <span className="font-medium text-green-900 dark:text-green-200 flex items-center gap-1.5">
              {isGoogle && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {isGoogle ? 'Google' : 'Email'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-sage-500 dark:text-green-700">Registrovaný</span>
            <span className="font-medium text-green-900 dark:text-green-200">{createdAt}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-sage-500 dark:text-green-700">User ID</span>
            <span className="font-mono text-xs text-sage-400 dark:text-green-700 truncate max-w-[180px]">{user?.id}</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
          text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20
          border border-red-200/50 dark:border-red-900/20
          hover:bg-red-100 dark:hover:bg-red-950/30
          transition-all active:scale-[0.98]">
        <LogOut className="w-4 h-4" />
        Odhlásiť sa
      </button>
    </div>
  );
}
