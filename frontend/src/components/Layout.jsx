import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Leaf, LayoutDashboard, Bell, Menu, X } from 'lucide-react';
import InteractiveBg from './InteractiveBg';
import ThemeToggle from './ThemeToggle';

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Prehľad' },
  { path: '/alerts', icon: Bell, label: 'Alerty' },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen relative isolate overflow-hidden transition-colors duration-300">
      <InteractiveBg />

      <header className="relative sticky top-0 z-50 border-b border-green-100/50 dark:border-green-900/30 nav-shell"
        style={{ backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)' }}>
        <div className="bg-white/72 dark:bg-[#09090b]/80">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 nav-item-animate stagger-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center dark:shadow-[0_0_12px_rgba(74,222,128,0.2)]"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-green-900 dark:text-green-100">SmartPot</span>
                <span className="text-[9px] font-mono font-medium text-sage-400 dark:text-green-700 tracking-widest uppercase leading-none">v1.0</span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <nav className="hidden sm:flex items-center gap-1">
                {nav.map(({ path, icon: Icon, label }, index) => {
                  const active = location.pathname === path;
                  return (
                    <Link key={path} to={path} style={{ animationDelay: `${0.08 + index * 0.05}s` }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 nav-item-animate hover-lift
                        ${active
                          ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 dark:shadow-[0_0_8px_rgba(74,222,128,0.06)]'
                          : 'text-sage-600 dark:text-sage-400 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/30'
                        }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <ThemeToggle />

              <button className="sm:hidden p-2 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/40 transition-colors nav-item-animate stagger-2"
                onClick={() => setOpen(!open)}>
                {open
                  ? <X className="w-5 h-5 text-sage-600 dark:text-green-400" />
                  : <Menu className="w-5 h-5 text-sage-600 dark:text-green-400" />}
              </button>
            </div>
          </div>

          {open && (
            <nav className="sm:hidden px-4 pb-4 flex flex-col gap-1 mobile-nav-panel">
              {nav.map(({ path, icon: Icon, label }, index) => {
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} onClick={() => setOpen(false)} style={{ animationDelay: `${0.03 + index * 0.04}s` }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all nav-item-animate
                      ${active
                        ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'text-sage-600 dark:text-sage-400 hover:bg-green-50/50 dark:hover:bg-green-900/30'
                      }`}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-8 sm:pb-8">
        <Outlet />
      </main>

      <footer className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="pt-5 border-t border-sage-100/40 dark:border-green-900/20 flex items-center justify-between text-xs text-sage-400 dark:text-green-800 font-mono">
          <span>SmartPot v1.0</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 dark:shadow-[0_0_4px_rgba(74,222,128,0.4)]" />
            online
          </span>
        </div>
      </footer>
    </div>
  );
}
