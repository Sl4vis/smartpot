import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Leaf, LayoutDashboard, Bell, Menu, X } from 'lucide-react';
import AmbientBackground from './AmbientBackground';

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Prehľad' },
  { path: '/alerts', icon: Bell, label: 'Alerty' },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen relative isolate overflow-hidden">
      <AmbientBackground />
      <header className="relative sticky top-0 z-50 backdrop-blur-md bg-white/72 border-b border-green-100/50 nav-shell">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 nav-item-animate stagger-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-green-900">SmartPot</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {nav.map(({ path, icon: Icon, label }, index) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path} style={{ animationDelay: `${0.08 + index * 0.05}s` }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 nav-item-animate hover-lift
                    ${active
                      ? 'bg-green-50 text-green-700'
                      : 'text-sage-600 hover:text-green-700 hover:bg-green-50/50'
                    }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <button className="sm:hidden p-2 rounded-xl hover:bg-green-50 transition-colors nav-item-animate stagger-2"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5 text-sage-600" /> : <Menu className="w-5 h-5 text-sage-600" />}
          </button>
        </div>

        {open && (
          <nav className="sm:hidden px-4 pb-4 flex flex-col gap-1 mobile-nav-panel">
            {nav.map(({ path, icon: Icon, label }, index) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path} onClick={() => setOpen(false)} style={{ animationDelay: `${0.03 + index * 0.04}s` }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all nav-item-animate
                    ${active ? 'bg-green-50 text-green-700' : 'text-sage-600'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-8 sm:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
