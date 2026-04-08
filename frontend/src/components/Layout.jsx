import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, LayoutDashboard, Bell, Menu, X, LogOut, Settings } from 'lucide-react';
import InteractiveBg from './InteractiveBg';
import ThemeToggle from './ThemeToggle';
import { useAuth } from './AuthProvider';

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Prehľad', showLabel: true },
  { path: '/alerts', icon: Bell, label: 'Alerty', showLabel: false },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate('/auth');
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
              <span className="text-lg font-bold text-green-900 dark:text-green-100">SmartPot</span>
            </Link>

            <div className="flex items-center gap-2">
              <nav className="hidden sm:flex items-center gap-1">
                {nav.map(({ path, icon: Icon, label, showLabel }, index) => {
                  const active = location.pathname === path;
                  return (
                    <Link key={path} to={path} style={{ animationDelay: `${0.08 + index * 0.05}s` }}
                      title={label}
                      className={`flex items-center gap-2 ${showLabel ? 'px-4' : 'px-3'} py-2 rounded-xl text-sm font-medium transition-all duration-200 nav-item-animate hover-lift
                        ${active
                          ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 dark:shadow-[0_0_8px_rgba(74,222,128,0.06)]'
                          : 'text-sage-600 dark:text-sage-400 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/30'
                        }`}>
                      <Icon className="w-4 h-4" />
                      {showLabel && label}
                    </Link>
                  );
                })}
              </nav>

              <ThemeToggle />

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold
                    bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400
                    hover:bg-green-200 dark:hover:bg-green-800/50 transition-all active:scale-90">
                  {userInitials}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden
                    bg-white dark:bg-[#111] border border-sage-200/60 dark:border-green-900/30
                    shadow-xl dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                    style={{ animation: 'modalIn 0.2s ease-out' }}>

                    <div className="px-4 py-3 border-b border-sage-100 dark:border-green-900/20">
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100 truncate">{userName}</p>
                      <p className="text-xs text-sage-400 dark:text-green-700 truncate">{user?.email}</p>
                    </div>

                    <div className="p-1.5">
                      <Link to="/settings" onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                          text-green-800 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all">
                        <Settings className="w-4 h-4" />
                        Nastavenia
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                          text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                        <LogOut className="w-4 h-4" />
                        Odhlásiť sa
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
              <Link to="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sage-600 dark:text-sage-400 hover:bg-green-50/50 dark:hover:bg-green-900/30 transition-all nav-item-animate">
                <Settings className="w-4 h-4" />
                Nastavenia
              </Link>
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                <LogOut className="w-4 h-4" />
                Odhlásiť sa
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-8 sm:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
