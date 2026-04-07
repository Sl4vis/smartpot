import React, { useRef, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeProvider';

const PARTICLE_COUNT = 70;

class Dot {
  constructor(W, H) { this.W = W; this.H = H; this.init(); }
  init() {
    this.x = Math.random() * this.W; this.y = Math.random() * this.H;
    this.baseR = Math.random() * 1.5 + 0.5; this.r = this.baseR;
    this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3;
    this.baseAlpha = Math.random() * 0.3 + 0.1; this.alpha = this.baseAlpha;
    this.phase = Math.random() * Math.PI * 2; this.speed = Math.random() * 0.01 + 0.003;
  }
  resize(W, H) { this.x = (this.x / this.W) * W; this.y = (this.y / this.H) * H; this.W = W; this.H = H; }
  update(mx, my) {
    this.phase += this.speed;
    this.alpha = this.baseAlpha * (Math.sin(this.phase) * 0.3 + 0.7);
    this.x += this.vx; this.y += this.vy;
    const dx = mx - this.x, dy = my - this.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 160) {
      const f = (160 - dist) / 160;
      this.vx += (dx / dist) * f * 0.08; this.vy += (dy / dist) * f * 0.08;
      this.alpha = Math.min(0.8, this.baseAlpha + f * 0.5);
      this.r = this.baseR * (1 + f * 1.5);
    } else { this.r += (this.baseR - this.r) * 0.05; }
    this.vx *= 0.98; this.vy *= 0.98;
    if (this.x < -10) this.x = this.W + 10; if (this.x > this.W + 10) this.x = -10;
    if (this.y < -10) this.y = this.H + 10; if (this.y > this.H + 10) this.y = -10;
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
    const dpr = dprRef.current, rect = c.parentElement.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    dotsRef.current.forEach(d => d.resize(c.width, c.height));
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); const dpr = dprRef.current;
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
      const W = c.width, H = c.height, mx = mouseRef.current.x, my = mouseRef.current.y, dots = dotsRef.current;
      const isDark = darkRef.current;
      ctx.clearRect(0, 0, W, H);

      const dotColor = isDark ? '74,222,128' : '22,163,74';
      const lineColor = isDark ? 'rgba(74,222,128,' : 'rgba(22,163,74,';

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const a = ((100 - dist) / 100) * (isDark ? 0.12 : 0.06);
            ctx.strokeStyle = lineColor + a + ')'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
          }
        }
      }

      if (mx > 0 && my > 0) {
        for (const d of dots) {
          const dx = mx - d.x, dy = my - d.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const a = ((150 - dist) / 150) * (isDark ? 0.2 : 0.1);
            ctx.strokeStyle = lineColor + a + ')'; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(d.x, d.y); ctx.stroke();
          }
        }
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
        g.addColorStop(0, `rgba(${dotColor},${isDark ? 0.06 : 0.03})`);
        g.addColorStop(1, `rgba(${dotColor},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 60, 0, Math.PI * 2); ctx.fill();
      }

      for (const d of dots) {
        d.update(mx, my);
        if (isDark && d.alpha > 0.3) {
          const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
          g.addColorStop(0, `rgba(${dotColor},${d.alpha * 0.3})`);
          g.addColorStop(1, `rgba(${dotColor},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotColor},${d.alpha})`; ctx.fill();
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
