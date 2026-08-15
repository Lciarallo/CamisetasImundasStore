const STORAGE_KEY = 'insanas_customer_orders';
const CHECKOUT_ATTEMPT_KEY = 'insanas_checkout_attempt';
const MAX_SAVED_ORDERS = 10;

export interface CustomerOrderAccess {
  id: string;
  token: string;
}

function isCustomerOrderAccess(value: unknown): value is CustomerOrderAccess {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.token === 'string' &&
    candidate.token.trim().length > 0
  );
}

/** Lê apenas o formato atual e descarta IDs legados que não têm token. */
export function readCustomerOrderAccess(): CustomerOrderAccess[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    const unique = new Map<string, CustomerOrderAccess>();
    for (const entry of parsed) {
      if (!isCustomerOrderAccess(entry)) continue;
      const normalized = { id: entry.id.trim(), token: entry.token.trim() };
      unique.set(normalized.id, normalized);
    }

    const result = Array.from(unique.values()).slice(0, MAX_SAVED_ORDERS);
    if (result.length !== parsed.length) {
      if (result.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return result;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // O storage inteiro está indisponível.
    }
    return [];
  }
}

export function saveCustomerOrderAccess(access: CustomerOrderAccess): void {
  const normalized = { id: access.id.trim(), token: access.token.trim() };
  if (!normalized.id || !normalized.token) return;

  try {
    const previous = readCustomerOrderAccess().filter((entry) => entry.id !== normalized.id);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([normalized, ...previous].slice(0, MAX_SAVED_ORDERS)),
    );
  } catch {
    // localStorage pode estar bloqueado; o código ainda pode ser guardado manualmente.
  }
}

/**
 * Mantém a mesma chave durante um checkout/reload do mesmo carrinho. Assim,
 * uma resposta perdida não cria outra reserva quando o visitante tenta de novo.
 */
export function checkoutIdempotencyKey(fingerprint: string): string {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { fingerprint?: unknown; token?: unknown };
      if (
        parsed.fingerprint === fingerprint &&
        typeof parsed.token === 'string' &&
        /^[A-Za-z0-9_-]{20,128}$/.test(parsed.token)
      ) {
        return parsed.token;
      }
    }

    const token = crypto.randomUUID();
    sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ fingerprint, token }));
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearCheckoutAttempt(token: string): void {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { token?: unknown };
    if (parsed.token === token) sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
  } catch {
    // sessionStorage indisponível ou registro corrompido.
  }
}

/** Remove PII gravada por versões anteriores do checkout. */
export function clearLegacyCustomerData(): void {
  try {
    localStorage.removeItem('insanas_saved_customer');
    localStorage.removeItem('insanas_saved_address');
    localStorage.removeItem('insanas_customer_email');
    localStorage.removeItem('camisetas-insanas:orders');
  } catch {
    // Navegação privada ou política do navegador pode bloquear o storage.
  }
}
