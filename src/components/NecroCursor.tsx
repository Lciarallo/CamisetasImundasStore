import { useEffect, useRef, useState } from 'react';
import { DoubleRing, HeptagramStar } from './art/Sigils';

/**
 * Cursor temático: o heptagrama {7/3} dentro do círculo duplo.
 *
 * As duas camadas se movem separadas de propósito — a estrela cola no ponteiro
 * e gira devagar; o círculo duplo persegue com atraso e gira ao contrário. O
 * descompasso entre elas é o que dá peso ao movimento; se as duas colassem no
 * ponteiro, o sigilo pareceria um adesivo.
 *
 * Só entra em ponteiro fino (mouse/trackpad). Em toque, ou quando o sistema
 * pede menos movimento, o cursor nativo permanece — cursor customizado é
 * enfeite, não pode custar usabilidade a quem depende do padrão.
 */
export function NecroCursor() {
  const starRef = useRef<HTMLDivElement>(null);
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

  // `interactive` e `pressed` entram por ref para o laço de animação ler o
  // valor atual sem precisar reiniciar o requestAnimationFrame a cada mudança.
  const interactiveRef = useRef(false);
  const pressedRef = useRef(false);
  interactiveRef.current = interactive;
  pressedRef.current = pressed;

  useEffect(() => {
    if (!enabled) return;

    const canvas = trailRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const pointer = { x: -200, y: -200 };
    const ring = { x: -200, y: -200 };
    let starAngle = 0;
    let ringAngle = 0;
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

      // Sobre qualquer coisa clicável o sigilo acende e acelera.
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
      const hot = interactiveRef.current;

      // A estrela gira devagar; sobre algo clicável, três vezes mais rápido.
      starAngle = (starAngle + (hot ? 1.5 : 0.45)) % 360;
      // O círculo gira ao contrário, sempre mais lento que a estrela.
      ringAngle = (ringAngle - (hot ? 0.7 : 0.22) + 360) % 360;

      // Perseguição com atraso: mais frouxo parado, mais firme sobre um alvo.
      const ease = hot ? 0.24 : 0.14;
      ring.x += (pointer.x - ring.x) * ease;
      ring.y += (pointer.y - ring.y) * ease;

      if (starRef.current) {
        starRef.current.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) rotate(${starAngle}deg)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) rotate(${ringAngle}deg)`;
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

        const alpha = ember.life * 0.7;
        // Vermelho vivo no início, esmaecendo para osso no fim.
        const red = 190 + Math.floor(60 * ember.life);
        const rest = Math.floor(40 * (1 - ember.life)) + 12;
        context.fillStyle = `rgba(${red}, ${rest}, ${rest}, ${alpha})`;
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

  const ink = interactive ? '#cf1a26' : '#e8e5dd';
  // A estrela ocupa 76% da própria caixa e o aro interno 83% da dele. Os
  // tamanhos abaixo deixam as pontas quase encostando no aro, como no símbolo
  // original — sobra só a folga que deixa as duas camadas legíveis ao girar.
  const starSize = interactive ? 38 : 28;
  const ringSize = interactive ? 44 : 32;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]">
      <canvas
        ref={trailRef}
        className="absolute inset-0"
        style={{ opacity: visible ? 0.85 : 0 }}
      />

      {/*
        Os contêineres têm tamanho zero de propósito: assim `transform-origin`
        cai exatamente sobre o ponteiro, e a rotação aplicada neles gira o
        sigilo em torno do próprio centro — não em torno de um canto.
      */}

      {/* Círculo duplo — persegue com atraso, gira ao contrário */}
      <div
        ref={ringRef}
        className="absolute top-0 left-0 h-0 w-0 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <DoubleRing
          strokeWidth={interactive ? 2.4 : 1.8}
          className="absolute transition-all duration-200 ease-out"
          style={{
            width: ringSize,
            height: ringSize,
            left: -ringSize / 2,
            top: -ringSize / 2,
            color: ink,
            opacity: interactive ? 0.95 : 0.5,
            filter: interactive ? 'drop-shadow(0 0 8px rgba(207,26,38,0.7))' : 'none',
          }}
        />
      </div>

      {/* Heptagrama — colado no ponteiro */}
      <div
        ref={starRef}
        className="absolute top-0 left-0 h-0 w-0 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <HeptagramStar
          strokeWidth={interactive ? 3.4 : 2.8}
          className="absolute transition-all duration-200 ease-out"
          style={{
            width: starSize,
            height: starSize,
            left: -starSize / 2,
            top: -starSize / 2,
            color: ink,
            transform: `scale(${pressed ? 0.75 : 1})`,
            filter: interactive
              ? 'drop-shadow(0 0 6px rgba(207,26,38,0.9))'
              : 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
          }}
        />

        {/*
          Ponto exato do ponteiro. O sigilo é simétrico e sem bico, então sem
          esta marca não dá para saber onde se está clicando. Gira junto com o
          contêiner, mas por estar centrado na origem da rotação não se move.
        */}
        <span
          className="absolute rounded-full"
          style={{
            width: 3,
            height: 3,
            left: -1.5,
            top: -1.5,
            backgroundColor: ink,
            boxShadow: '0 0 3px rgba(0,0,0,0.9)',
          }}
        />
      </div>
    </div>
  );
}
