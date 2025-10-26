import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useTranslation } from '../hooks/useTranslation';
import './NotFoundPage.css';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const emojiRef = useRef(null);
  const angleRef = useRef(0); // degrees
  const velocityRef = useRef(30); // degrees per second, start with small spin
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  // animation parameters
  const ACCEL = 240; // degrees per second^2 (how quickly angular velocity changes)
  const SCALE_LERP = 40; // much faster lerp so scale snaps quickly when hovered
  const COLOR_LERP = 8; // slightly faster color smoothing
  const scaleRef = useRef(1);
  const colorMixRef = useRef(0); // 0..1

  useEffect(() => {
    const el = emojiRef.current;
    if (!el) return;

    const redColor = '#ff3b30';

    const hexToRgb = (hex) => {
      const h = hex.replace('#', '');
      const bigint = parseInt(h, 16);
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    };

    const rgbToCss = (rgb) => `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;

    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpColor = (c1, c2, t) => ({ r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) });

    const baseRgb = hexToRgb('#374151'); // Tailwind gray-700 fallback
    const redRgb = hexToRgb(redColor);

    const step = (time) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time;
      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000); // seconds, clamp to avoid big jumps
      lastTimeRef.current = time;


      // accelerate velocity: hovering -> positive accel (speed up clockwise), leaving -> negative accel (decelerate / reverse)
      const accel = isHovered ? ACCEL : -ACCEL;
      velocityRef.current += accel * dt;

      // integrate angle
      angleRef.current += velocityRef.current * dt;

      // scale behavior:
      // - when NOT hovered: keep scale at 1 (no growth)
      // - when hovered: quickly grow based on velocity + an extra hover boost
      let scaleTarget = 1;
      if (isHovered) {
        const baseScaleFromVelocity = 1 + Math.abs(velocityRef.current) / 300; // stronger influence when hovered
        const hoverExtra = 0.8; // immediate extra growth on hover
        scaleTarget = Math.max(1, baseScaleFromVelocity + hoverExtra);
      }

      // smooth scale towards target (use exponential smoothing so large frame gaps don't jump)
      // alpha = 1 - e^{-lambda * dt}
      const scaleAlpha = 1 - Math.exp(-SCALE_LERP * dt);
      scaleRef.current += (scaleTarget - scaleRef.current) * scaleAlpha;

      // color mix driven by hover state (r channel increases when hovered), smoothed with same approach
      const colorTarget = isHovered ? 1 : 0;
      const colorAlpha = 1 - Math.exp(-COLOR_LERP * dt);
      colorMixRef.current += (colorTarget - colorMixRef.current) * colorAlpha;
      const mixedRgb = lerpColor(baseRgb, redRgb, colorMixRef.current);

      // apply to element without forcing React updates
      el.style.transform = `rotate(${angleRef.current}deg) scale(${scaleRef.current})`;
      el.style.color = rgbToCss(mixedRgb);

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // isHovered included so animation responds to hover state
  }, [isHovered]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const emojiStyle = {
    display: 'inline-block',
    animation: `spin 20s linear infinite${isHovered ? ', emoji-hover-effect 2s ease-in-out' : ''}`,
    '--emoji-color-start': 'inherit', 
    '--emoji-color-end': '#ff6347',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">{t('notFoundPage.code', '404')}</h1>
        <div
          className="mb-6 flex items-center justify-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span
            aria-hidden
            ref={emojiRef}
            className="text-6xl emoji"
            style={{ display: 'inline-block' }}
          >
            {t('notFoundPage.emoji', '🤔')}
          </span>
        </div>
        <p className="text-lg text-gray-700 mb-2">{t('notFoundPage.message')}</p>
        <p className="text-base text-gray-600 mb-6">{t('notFoundPage.submessage')}</p>
        <div className="flex items-center justify-center gap-3">
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
          >
            {t('notFoundPage.refresh')}
          </Button>
          <Link to="/">
            <Button>
              {t('notFoundPage.home')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}