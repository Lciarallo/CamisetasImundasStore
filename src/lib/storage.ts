import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'necroteca:';

/**
 * Estado persistido em localStorage. Serve de camada de dados enquanto não há
 * backend — a superfície é a mesma de um `useState`, então trocar por chamadas
 * de API depois é uma mudança local, não uma reescrita.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, (update: T | ((previous: T) => T)) => void, () => void] {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // JSON corrompido ou localStorage bloqueado: cai no valor inicial.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Cota estourada ou modo privado — a app segue só em memória.
    }
  }, [storageKey, value]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setValue(typeof initial === 'function' ? (initial as () => T)() : initial);
    // `initial` é intencionalmente omitido: literais inline mudariam de
    // identidade a cada render e recriariam esta função sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return [value, setValue, reset];
}

/** Apaga tudo que a loja gravou — usado pelo botão de reset do admin. */
export function wipeStorage() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}
