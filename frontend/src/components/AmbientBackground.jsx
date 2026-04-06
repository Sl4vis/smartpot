import React, { useEffect, useRef } from 'react';

export default function AmbientBackground() {
  const rootRef = useRef(null);
  const rafRef = useRef(0);
  const currentRef = useRef({ x: 50, y: 22 });
  const targetRef = useRef({ x: 50, y: 22 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const media = window.matchMedia('(pointer: coarse)');

    const setVars = () => {
      root.style.setProperty('--cursor-x', `${currentRef.current.x}%`);
      root.style.setProperty('--cursor-y', `${currentRef.current.y}%`);
    };

    const animate = () => {
      const current = currentRef.current;
      const target = targetRef.current;

      current.x += (target.x - current.x) * 0.075;
      current.y += (target.y - current.y) * 0.075;
      setVars();
      rafRef.current = window.requestAnimationFrame(animate);
    };

    const updateTarget = (clientX, clientY) => {
      const x = (clientX / window.innerWidth) * 100;
      const y = (clientY / window.innerHeight) * 100;
      targetRef.current = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    };

    const handlePointerMove = (event) => {
      if (media.matches) return;
      updateTarget(event.clientX, event.clientY);
    };

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      updateTarget(touch.clientX, touch.clientY);
    };

    const resetTarget = () => {
      targetRef.current = { x: 50, y: 22 };
    };

    setVars();
    rafRef.current = window.requestAnimationFrame(animate);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mouseout', resetTarget);
    window.addEventListener('blur', resetTarget);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseout', resetTarget);
      window.removeEventListener('blur', resetTarget);
    };
  }, []);

  return (
    <div ref={rootRef} className="ambient-bg" aria-hidden="true">
      <div className="ambient-mesh" />
      <div className="ambient-vignette" />
      <div className="ambient-blob ambient-blob-leaf" />
      <div className="ambient-blob ambient-blob-leaf-2" />
      <div className="ambient-blob ambient-blob-water" />
      <div className="ambient-blob ambient-blob-water-2" />
      <div className="ambient-blob ambient-blob-sun" />
      <div className="ambient-cursor-halo" />
      <div className="ambient-cursor-core" />
      <div className="ambient-grain" />
    </div>
  );
}
