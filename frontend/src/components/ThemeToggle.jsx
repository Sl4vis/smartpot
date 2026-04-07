import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300
        bg-sage-50 hover:bg-sage-100 text-sage-600
        dark:bg-green-950/60 dark:hover:bg-green-900/60 dark:text-green-400 dark:hover:text-green-300
        dark:shadow-[0_0_8px_rgba(74,222,128,0.08)]"
      aria-label={dark ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}>
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
