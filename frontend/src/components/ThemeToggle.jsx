import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    setAnimating(true);
    toggle();
    setTimeout(() => setAnimating(false), 600);
  }

  return (
    <button onClick={handleClick}
      className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-500
        bg-sage-50 hover:bg-sage-100 dark:bg-green-950/60 dark:hover:bg-green-900/60
        hover:shadow-md dark:hover:shadow-[0_0_12px_rgba(74,222,128,0.12)]
        active:scale-90"
      aria-label={dark ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}>

      {/* Sun */}
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`w-[18px] h-[18px] absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${dark
            ? 'opacity-100 rotate-0 scale-100 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
            : 'opacity-0 -rotate-90 scale-50 text-amber-400'
          }`}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>

      {/* Moon */}
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`w-[18px] h-[18px] absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${dark
            ? 'opacity-0 rotate-90 scale-50 text-sage-500'
            : 'opacity-100 rotate-0 scale-100 text-sage-500'
          }`}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>

      {/* Flash ring on click */}
      {animating && (
        <span className={`absolute inset-0 rounded-xl animate-[themeFlash_0.6s_ease-out_forwards]
          ${dark ? 'bg-amber-400/20' : 'bg-indigo-400/15'}`} />
      )}
    </button>
  );
}
