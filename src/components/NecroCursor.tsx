import { useEffect, useRef, useState } from 'react';
import sigilUrl from '../assets/cursor-sigil.webp';

/**
 * Cursor temático: o pentagrama traçado à mão, com as duas setas.
 *
 * O desenho entra como bitmap, não como vetor: o traço irregular de caneta é
 * justamente o que dá caráter a ele, e vetorizar limparia isso. Para poder
 * trocar de cor, o PNG (branco sobre transparente) é usado como `mask-image`
 * e a cor vem do `background-color` — assim o mesmo arquivo serve de osso e
 * de sangue sem precisar de duas versões.
 *
 * Só entra em ponteiro fino (mouse/trackpad). Em toque, ou quando o sistema
 * pede menos movimento, o cursor nativo permanece — cursor customizado é
 * enfeite, não pode custar usabilidade a quem depende do padrão.
 */

/**
 * Onde as linhas do pentagrama se cruzam, em fração da imagem. É esse ponto
 * que fica sob o ponteiro — não o centro da caixa, que cairia deslocado por
 * causa da seta comprida que desce à direita.
 */
const HOT_X = 0.52;
const HOT_Y = 0.44;

export function NecroCursor() {
  const sigilRef = useRef<HTMLDivElement>(null);
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
      setVisible(true);

      // Posição escrita direto no DOM, fora do React: um setState por
      // movimento de mouse re-renderizaria a árvore inteira sem necessidade.
      if (sigilRef.current) {
        sigilRef.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
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

      // Sobre qualquer coisa clicável o sigilo acende e cresce.
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
  const size = interactive ? 46 : 36;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]">
      <canvas
        ref={trailRef}
        className="absolute inset-0"
        style={{ opacity: visible ? 0.85 : 0 }}
      />

      {/* Contêiner de tamanho zero: a origem cai exatamente sobre o ponteiro. */}
      <div
        ref={sigilRef}
        className="absolute top-0 left-0 h-0 w-0 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <span
          className="absolute block transition-all duration-200 ease-out"
          style={{
            width: size,
            height: size,
            left: -size * HOT_X,
            top: -size * HOT_Y,
            backgroundColor: ink,
            // O PNG é branco sobre transparente: como máscara, o alfa vira o
            // recorte e a cor de fundo pinta o traço.
            maskImage: `url(${sigilUrl})`,
            WebkitMaskImage: `url(${sigilUrl})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            transformOrigin: `${HOT_X * 100}% ${HOT_Y * 100}%`,
            transform: `rotate(${pressed ? -10 : 0}deg) scale(${pressed ? 0.86 : 1})`,
            filter: interactive
              ? 'drop-shadow(0 0 7px rgba(207,26,38,0.85))'
              : 'drop-shadow(0 1px 2px rgba(0,0,0,0.95))',
          }}
        />

        {/*
          Ponto exato do ponteiro. O sigilo é um rabisco sem bico definido, e
          sem esta marca a mira fica ambígua.
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
