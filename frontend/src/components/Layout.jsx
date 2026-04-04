import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Leaf, LayoutDashboard, Bell, PlusCircle, Menu, X } from 'lucide-react';

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Prehľad' },
  { path: '/add', icon: PlusCircle, label: 'Pridať' },
  { path: '/alerts', icon: Bell, label: 'Alerty' },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-green-100/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-green-900">SmartPot</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {nav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
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

          <button className="sm:hidden p-2 rounded-xl hover:bg-green-50 transition-colors"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5 text-sage-600" /> : <Menu className="w-5 h-5 text-sage-600" />}
          </button>
        </div>

        {open && (
          <nav className="sm:hidden px-4 pb-4 flex flex-col gap-1">
            {nav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${active ? 'bg-green-50 text-green-700' : 'text-sage-600'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
