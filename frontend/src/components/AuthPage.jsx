import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Leaf, Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';
import InteractiveBg from './InteractiveBg';

export default function AuthPage() {
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Redirect ak uz je prihlaseny
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message?.includes('Invalid login')) {
            setError('Nesprávny email alebo heslo');
          } else if (error.message?.includes('Email not confirmed')) {
            setError('Najprv potvrď svoj email — skontroluj schránku');
          } else {
            setError(error.message);
          }
        }
      } else if (mode === 'register') {
        if (!fullName.trim()) { setError('Meno je povinné'); setLoading(false); return; }
        if (password.length < 6) { setError('Heslo musí mať aspoň 6 znakov'); setLoading(false); return; }

        const { data, error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message?.includes('already registered')) {
            setError('Tento email je už zaregistrovaný');
          } else {
            setError(error.message);
          }
        } else if (data?.user && !data.user.email_confirmed_at) {
          setMessage('Registrácia úspešná! Skontroluj svoj email a klikni na potvrdzovací odkaz.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setMessage('Odkaz na obnovenie hesla bol odoslaný na tvoj email.');
          setMode('login');
        }
      }
    } catch (err) {
      setError('Niečo sa pokazilo. Skús to znova.');
    }

    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex relative overflow-hidden transition-colors duration-300">
      <InteractiveBg />

      {/* Left — branding (desktop only) */}
      <div className="hidden lg:flex lg:w-[45%] relative z-10 flex-col justify-center items-center p-12">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6
            dark:shadow-[0_0_24px_rgba(74,222,128,0.25)]"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-green-900 dark:text-green-100 mb-3">SmartPot</h1>
          <p className="text-sage-500 dark:text-green-600 leading-relaxed">
            Monitoruj svoje rastliny v reálnom čase. ESP32 senzory, AI analýza, inteligentné alerty.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { emoji: '🌡️', label: 'Teplota' },
              { emoji: '💧', label: 'Vlhkosť' },
              { emoji: '☀️', label: 'Svetlo' },
            ].map(({ emoji, label }) => (
              <div key={label} className="p-3 rounded-xl bg-white/60 dark:bg-green-950/40 border border-green-100/50 dark:border-green-900/20">
                <span className="text-2xl">{emoji}</span>
                <p className="text-xs text-sage-500 dark:text-green-600 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative z-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center
              dark:shadow-[0_0_16px_rgba(74,222,128,0.2)]"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-green-900 dark:text-green-100">SmartPot</span>
          </div>

          {/* Card */}
          <div className="card p-6 sm:p-8">
            {/* Tabs */}
            {mode !== 'forgot' && (
              <div className="flex gap-1 p-1 rounded-xl bg-sage-50/80 dark:bg-green-950/40 mb-6">
                {[
                  { id: 'login', label: 'Prihlásenie' },
                  { id: 'register', label: 'Registrácia' },
                ].map(({ id, label }) => (
                  <button key={id}
                    onClick={() => { setMode(id); setError(''); setMessage(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-250
                      ${mode === id
                        ? 'bg-white dark:bg-green-900/60 text-green-700 dark:text-green-400 shadow-sm'
                        : 'text-sage-400 dark:text-green-700 hover:text-sage-600 dark:hover:text-green-500'
                      }`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {mode === 'forgot' && (
              <div className="mb-6">
                <h2 className="text-lg font-bold text-green-900 dark:text-green-100">Obnovenie hesla</h2>
                <p className="text-sm text-sage-400 dark:text-green-700 mt-1">Zadaj email a pošleme ti odkaz</p>
              </div>
            )}

            {/* Messages */}
            {message && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/30 text-sm text-green-700 dark:text-green-400 mb-5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/20 text-sm text-red-600 dark:text-red-400 mb-5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-300 dark:text-green-800" />
                  <input type="text" placeholder="Celé meno" value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="input-field pl-10" required />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-300 dark:text-green-800" />
                <input type="email" placeholder="Email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field pl-10" required />
              </div>

              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-300 dark:text-green-800" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Heslo" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10" required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-300 dark:text-green-800 hover:text-sage-500 dark:hover:text-green-600 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                    className="text-xs text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 font-medium transition-colors">
                    Zabudnuté heslo?
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ArrowRight className="w-4 h-4" />}
                {mode === 'login' ? 'Prihlásiť sa' : mode === 'register' ? 'Zaregistrovať sa' : 'Odoslať odkaz'}
              </button>
            </form>

            {/* Divider */}
            {mode !== 'forgot' && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-sage-100 dark:bg-green-900/30" />
                  <span className="text-xs text-sage-400 dark:text-green-700">alebo</span>
                  <div className="flex-1 h-px bg-sage-100 dark:bg-green-900/30" />
                </div>

                <button onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                    bg-white dark:bg-green-950/40 border border-sage-200 dark:border-green-900/30
                    text-green-900 dark:text-green-200 hover:bg-sage-50 dark:hover:bg-green-900/30
                    transition-all duration-200 hover:shadow-sm active:scale-[0.98]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Pokračovať s Google
                </button>
              </>
            )}

            {mode === 'forgot' && (
              <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="w-full text-center text-sm text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 font-medium mt-4 transition-colors">
                Späť na prihlásenie
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
