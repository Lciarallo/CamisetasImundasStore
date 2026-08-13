import { createContext, useContext, type ReactNode } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { useFirebaseBackend } from './useFirebaseBackend';
import { useLocalBackend } from './useLocalBackend';
import type { StoreValue } from './types';

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Escolhe o backend uma vez, na carga do módulo.
 *
 * Precisa ser constante durante a vida da aplicação: os dois backends são
 * hooks, e alternar entre eles em tempo de execução mudaria a ordem das
 * chamadas de hook — o React quebra nisso. Como depende só de variável de
 * ambiente, que não muda em execução, decidir aqui é seguro.
 */
const useBackend = isFirebaseConfigured ? useFirebaseBackend : useLocalBackend;

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useBackend();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore precisa estar dentro de <StoreProvider>.');
  return context;
}

export { availableFor, totalStock, sizesFor, isSoldOut } from './cart';
export type { CartTotals, OrderDraft, Result, StoreValue } from './types';
