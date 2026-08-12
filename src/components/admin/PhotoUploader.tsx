import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, Trash2 } from 'lucide-react';
import {
  ImageError,
  dataUrlBytes,
  formatBytes,
  imagesFromTransfer,
  prepareImage,
} from '../../lib/image';

/** Teto por peça: além disso o localStorage começa a apertar. */
const MAX_PHOTOS = 4;

export function PhotoUploader({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const totalBytes = photos.reduce((sum, photo) => sum + dataUrlBytes(photo), 0);
  const remaining = MAX_PHOTOS - photos.length;

  const accept = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError('');

      if (remaining <= 0) {
        setError(`Máximo de ${MAX_PHOTOS} fotos por peça.`);
        return;
      }

      setBusy(true);
      const accepted: string[] = [];
      const problems: string[] = [];

      // Sequencial de propósito: processar em paralelo dispara vários canvas
      // grandes ao mesmo tempo e trava a aba em máquina modesta.
      for (const file of files.slice(0, remaining)) {
        try {
          const prepared = await prepareImage(file);
          accepted.push(prepared.dataUrl);
        } catch (cause) {
          problems.push(
            cause instanceof ImageError ? cause.message : `Falha ao ler ${file.name}.`,
          );
        }
      }

      if (accepted.length > 0) onChange([...photos, ...accepted]);
      if (files.length > remaining) {
        problems.push(`Só couberam ${remaining} — o limite é ${MAX_PHOTOS} por peça.`);
      }
      setError(problems.join(' '));
      setBusy(false);
    },
    [photos, remaining, onChange],
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
    setError('');
  };

  return (
    <div>
      <span className="label flex items-baseline justify-between gap-2">
        Fotos da peça
        {photos.length > 0 && (
          <span className="text-[0.6rem] normal-case text-dust tabular-nums">
            {photos.length}/{MAX_PHOTOS} · {formatBytes(totalBytes)}
          </span>
        )}
      </span>

      {/* Área de soltar / colar */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(imagesFromTransfer(event.dataTransfer));
        }}
        onPaste={(event) => void accept(imagesFromTransfer(event.clipboardData))}
        className={`flex flex-col items-center gap-2 border border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-blood bg-blood/10' : 'border-iron'
        } ${remaining <= 0 ? 'opacity-50' : ''}`}
      >
        {busy ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-blood-bright" />
        ) : (
          <ImagePlus className="h-5 w-5 text-grave" />
        )}

        <p className="text-[0.7rem] text-parchment">
          {busy
            ? 'Processando…'
            : remaining <= 0
              ? `Limite de ${MAX_PHOTOS} fotos atingido`
              : 'Arraste as fotos aqui, cole com Ctrl+V ou'}
        </p>

        {!busy && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn btn-ghost px-4 py-1.5"
          >
            Escolher arquivos
          </button>
        )}

        <p className="text-[0.6rem] text-dust">
          JPG, PNG ou WebP · redimensionadas para 1000px e recomprimidas
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void accept(Array.from(event.target.files ?? []));
            // Zera para permitir escolher o mesmo arquivo de novo.
            event.target.value = '';
          }}
        />
      </div>

      {error && <p className="mt-2 text-[0.65rem] text-ember">{error}</p>}

      {/* Miniaturas */}
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <li key={index} className="group relative border border-smoke bg-pitch">
              <img
                src={photo}
                alt={`Foto ${index + 1}`}
                className="aspect-[300/340] w-full object-cover"
              />

              {index === 0 && (
                <span className="tag absolute top-1 left-1 border-blood bg-blood text-[0.5rem] text-bone">
                  <Star className="h-2 w-2" />
                  Capa
                </span>
              )}

              {/* Controles: aparecem no hover, mas o foco por teclado também os traz */}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-void/85 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  className="p-1 text-parchment hover:text-blood-bright disabled:text-dust"
                  aria-label={`Mover foto ${index + 1} para a esquerda`}
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === photos.length - 1}
                  className="p-1 text-parchment hover:text-blood-bright disabled:text-dust"
                  aria-label={`Mover foto ${index + 1} para a direita`}
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-parchment hover:text-ember"
                  aria-label={`Remover foto ${index + 1}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[0.62rem] text-grave">
        {photos.length === 0
          ? 'Sem foto, a peça usa a arte vetorial do sigilo escolhido.'
          : 'A primeira foto é a capa no catálogo. Use as setas para reordenar.'}
      </p>
    </div>
  );
}
