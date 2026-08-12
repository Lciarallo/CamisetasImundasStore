import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'camisetas-insanas:';

/** Evento disparado quando o navegador recusa a gravação por falta de espaço. */
export const QUOTA_EVENT = 'camisetas-insanas:quota-exceeded';

/**
 * O nome do erro varia entre navegadores, e o Firefox usa um código próprio,
 * então checar só `name === 'QuotaExceededError'` deixaria casos passarem.
 */
function isQuotaError(cause: unknown): boolean {
  if (!(cause instanceof DOMException)) return false;
  return (
    cause.name === 'QuotaExceededError' ||
    cause.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    cause.code === 22 ||
    cause.code === 1014
  );
}

let quotaWarned = false;
function notifyQuotaExceeded(key: string) {
  // Um aviso por sessão: o efeito roda a cada alteração e encheria a tela.
  if (quotaWarned) return;
  quotaWarned = true;
  console.warn(`[camisetas-insanas] armazenamento cheio ao gravar "${key}".`);
  window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: { key } }));
}

/** Quantos bytes a loja já ocupa em localStorage. */
export function storageUsage(): number {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) total += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  // UTF-16: cada caractere ocupa 2 bytes.
  return total * 2;
}

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
    } catch (cause) {
      // Cota estourada ou modo privado. A app segue em memória, mas falhar em
      // silêncio seria pior que o erro: quem acabou de subir uma foto veria
      // ela sumir no reload sem nenhuma explicação.
      if (isQuotaError(cause)) notifyQuotaExceeded(storageKey);
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
