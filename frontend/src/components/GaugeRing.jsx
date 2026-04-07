import React from 'react';
import { useTheme } from './ThemeProvider';

export default function GaugeRing({ value = 0, size = 72, strokeWidth = 5, color = '#22c55e', children }) {
  const { dark } = useTheme();
  const trackColor = dark ? '#1a2e1a' : '#eaede7';
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(Math.max(value, 0), 100) / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity="0.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s ease-out',
            filter: dark ? `drop-shadow(0 0 6px ${color}55)` : 'none',
          }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
