import React, { useRef, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeProvider';

const PARTICLE_COUNT = 100;
const CONN_DIST = 140;
const CURSOR_DIST = 120;

class Dot {
  constructor(W, H) { this.W = W; this.H = H; this.init(); }
  init() {
    this.x = Math.random() * this.W;
    this.y = Math.random() * this.H;
    this.type = Math.random() > 0.8 ? 'glow' : 'dot';
    this.baseR = this.type === 'glow' ? Math.random() * 2 + 1 : Math.random() * 2.5 + 1;
    this.r = this.baseR;
    this.vx = (Math.random() - 0.5) * 0.7;
    this.vy = (Math.random() - 0.5) * 0.7;
    this.baseAlpha = this.type === 'glow'
      ? Math.random() * 0.5 + 0.3
      : Math.random() * 0.35 + 0.15;
    this.alpha = this.baseAlpha;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = Math.random() * 0.02 + 0.008;
    this.drift = Math.random() * 0.5 + 0.2;
    this.glowR = Math.random() * 16 + 8;
  }
  resize(W, H) {
    this.x = (this.x / this.W) * W;
    this.y = (this.y / this.H) * H;
    this.W = W; this.H = H;
  }
  update(mx, my) {
    this.phase += this.speed;
    this.alpha = this.baseAlpha * (Math.sin(this.phase) * 0.35 + 0.65);

    // Organic drift
    this.x += this.vx + Math.sin(this.phase * 0.6) * this.drift * 0.4;
    this.y += this.vy + Math.cos(this.phase * 0.4) * this.drift * 0.4;

    // Cursor interaction
    const dx = mx - this.x, dy = my - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CURSOR_DIST && dist > 0) {
      const f = (CURSOR_DIST - dist) / CURSOR_DIST;
      const ang = Math.atan2(dy, dx);
      if (this.type === 'glow') {
        // Glow particles gently drift toward cursor
        this.vx += Math.cos(ang) * f * 0.03;
        this.vy += Math.sin(ang) * f * 0.03;
        this.alpha = Math.min(1, this.baseAlpha + f * 0.3);
        this.r = this.baseR * (1 + f * 1.2);
      } else {
        // Regular dots softly pushed away
        this.vx -= Math.cos(ang) * f * 0.02;
        this.vy -= Math.sin(ang) * f * 0.02;
        this.r = this.baseR * (1 + f * 0.3);
      }
    } else {
      this.r += (this.baseR - this.r) * 0.06;
    }

    this.vx *= 0.982;
    this.vy *= 0.982;

    // Wrap around
    if (this.x < -20) this.x = this.W + 20;
    if (this.x > this.W + 20) this.x = -20;
    if (this.y < -20) this.y = this.H + 20;
    if (this.y > this.H + 20) this.y = -20;
  }
}

export default function InteractiveBg() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const dotsRef = useRef([]);
  const animRef = useRef(null);
  const dprRef = useRef(window.devicePixelRatio || 1);
  const { dark } = useTheme();
  const darkRef = useRef(dark);
  useEffect(() => { darkRef.current = dark; }, [dark]);

  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = dprRef.current;
    const rect = c.parentElement.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    dotsRef.current.forEach(d => d.resize(c.width, c.height));
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = dprRef.current;
    resize();
    dotsRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Dot(c.width, c.height));

    const onMove = e => { mouseRef.current = { x: e.clientX * dpr, y: e.clientY * dpr }; };
    const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; };
    const onTouch = e => { mouseRef.current = { x: e.touches[0].clientX * dpr, y: e.touches[0].clientY * dpr }; };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('resize', resize);

    function animate() {
      const W = c.width, H = c.height;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const dots = dotsRef.current;
      const isDark = darkRef.current;
      ctx.clearRect(0, 0, W, H);

      const rgb = isDark ? '74,222,128' : '34,197,94';
      const connAlphaScale = isDark ? 0.18 : 0.09;
      const cursorAlphaScale = isDark ? 0.14 : 0.07;

      // Particle-to-particle connections
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONN_DIST) {
            const a = ((CONN_DIST - dist) / CONN_DIST) * connAlphaScale;
            ctx.strokeStyle = `rgba(${rgb},${a})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      // Cursor connections + glow
      if (mx > 0 && my > 0) {
        for (const d of dots) {
          const dx = mx - d.x, dy = my - d.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CURSOR_DIST) {
            const a = ((CURSOR_DIST - dist) / CURSOR_DIST) * cursorAlphaScale;
            ctx.strokeStyle = `rgba(${rgb},${a})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
          }
        }

        // Cursor glow
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 40);
        g.addColorStop(0, `rgba(${rgb},${isDark ? 0.05 : 0.03})`);
        g.addColorStop(0.6, `rgba(${rgb},${isDark ? 0.015 : 0.008})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw particles
      for (const d of dots) {
        d.update(mx, my);

        // Glow halo for glow-type particles
        if (d.type === 'glow') {
          const gs = d.glowR * (d.r / d.baseR);
          const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, gs);
          g.addColorStop(0, `rgba(${rgb},${d.alpha * (isDark ? 0.3 : 0.15)})`);
          g.addColorStop(0.4, `rgba(${rgb},${d.alpha * (isDark ? 0.08 : 0.04)})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(d.x, d.y, gs, 0, Math.PI * 2);
          ctx.fill();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${d.alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
}
