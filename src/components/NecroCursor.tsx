import { useEffect, useRef, useState } from 'react';

/**
 * Cursor temático: uma caveira que segue o ponteiro com rastro de brasas.
 *
 * Só entra em ponteiro fino (mouse/trackpad). Em toque, ou quando o sistema
 * pede menos movimento, o cursor nativo permanece — cursor customizado é
 * enfeite, não pode custar usabilidade a quem depende do padrão.
 */
export function NecroCursor() {
  const skullRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);

  const [enabled, setEnabled] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Habilita só onde faz sentido, e reavalia se o usuário mudar a preferência.
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

    const evaluate = () => setEnabled(fine.matches && !calm.matches);
    evaluate();

    fine.addEventListener('change', evaluate);
    calm.addEventListener('change', evaluate);
    return () => {
      fine.removeEventListener('change', evaluate);
      calm.removeEventListener('change', evaluate);
    };
  }, []);

  // A classe no <html> é o que apaga o cursor nativo (regra em index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('necro-cursor', enabled);
    return () => document.documentElement.classList.remove('necro-cursor');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = trailRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const pointer = { x: -100, y: -100 };
    // O anel persegue o ponteiro com atraso — dá peso ao movimento.
    const ring = { x: -100, y: -100 };
    const embers: { x: number; y: number; life: number; size: number; drift: number }[] = [];

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      setVisible(true);

      if (skullRef.current) {
        skullRef.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }

      // Brasas nascem no rastro, com deriva lateral aleatória.
      if (embers.length < 90) {
        embers.push({
          x: event.clientX,
          y: event.clientY,
          life: 1,
          size: 1 + Math.random() * 2.2,
          drift: (Math.random() - 0.5) * 0.6,
        });
      }

      // Sobre qualquer coisa clicável o cursor abre e acende.
      const target = event.target as Element | null;
      setInteractive(
        Boolean(
          target?.closest(
            'a, button, input, select, textarea, label, [role="button"], [data-interactive]',
          ),
        ),
      );
    };

    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    let frame = 0;
    const render = () => {
      ring.x += (pointer.x - ring.x) * 0.16;
      ring.y += (pointer.y - ring.y) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
      }

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = embers.length - 1; i >= 0; i--) {
        const ember = embers[i];
        ember.life -= 0.028;
        if (ember.life <= 0) {
          embers.splice(i, 1);
          continue;
        }
        // Sobem enquanto apagam, como cinza quente.
        ember.y -= 0.5;
        ember.x += ember.drift;

        const alpha = ember.life * 0.75;
        // Vermelho vivo no início, esmaecendo para osso no fim.
        const red = 190 + Math.floor(60 * ember.life);
        const green = Math.floor(40 * (1 - ember.life)) + 12;
        context.fillStyle = `rgba(${red}, ${green}, ${green}, ${alpha})`;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.size * ember.life, 0, Math.PI * 2);
        context.fill();
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]">
      <canvas
        ref={trailRef}
        className="absolute inset-0"
        style={{ opacity: visible ? 0.85 : 0 }}
      />

      {/* Anel que persegue com atraso */}
      <div
        ref={ringRef}
        className="absolute top-0 left-0 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="rounded-full border transition-all duration-200 ease-out"
          style={{
            width: interactive ? 46 : 30,
            height: interactive ? 46 : 30,
            borderColor: interactive ? 'rgba(207,26,38,0.85)' : 'rgba(139,133,120,0.45)',
            boxShadow: interactive ? '0 0 20px rgba(207,26,38,0.45)' : 'none',
            transform: `translate(-50%, -50%) scale(${pressed ? 0.72 : 1})`,
          }}
        />
      </div>

      {/* Caveira colada no ponteiro */}
      <div
        ref={skullRef}
        className="absolute top-0 left-0 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <svg
          viewBox="0 0 64 64"
          className="transition-transform duration-200 ease-out"
          style={{
            width: interactive ? 26 : 20,
            height: interactive ? 26 : 20,
            transform: `translate(-50%, -50%) rotate(${pressed ? -12 : 0}deg) scale(${pressed ? 0.85 : 1})`,
            filter: interactive
              ? 'drop-shadow(0 0 6px rgba(207,26,38,0.9))'
              : 'drop-shadow(0 0 3px rgba(0,0,0,0.9))',
          }}
        >
          <path
            fill={interactive ? '#cf1a26' : '#e8e5dd'}
            d="M32 4C18.7 4 8.5 13.9 8.5 27.2c0 7 2.8 12 6.6 15.3 1.5 1.3 2.2 2.2 2.4 3.7l.6 4.4c.3 2.2 2.1 3.8 4.3 3.8h20.2c2.2 0 4-1.6 4.3-3.8l.6-4.4c.2-1.5.9-2.4 2.4-3.7 3.8-3.3 6.6-8.3 6.6-15.3C55.5 13.9 45.3 4 32 4Z"
          />
          <ellipse cx="22.5" cy="28" rx="6.6" ry="7.8" fill="#050506" />
          <ellipse cx="41.5" cy="28" rx="6.6" ry="7.8" fill="#050506" />
          <path
            d="M32 35c1.9 0 3.6 2.7 3.6 4.8S34.1 42.4 32 42.4s-3.6-.9-3.6-2.6S30.1 35 32 35Z"
            fill="#050506"
          />
          <path
            d="M24 47h2.6v7.4H24zm5.7 0h2.6v7.4h-2.6zm5.7 0H38v7.4h-2.6z"
            fill="#050506"
          />
        </svg>
      </div>
    </div>
  );
}
