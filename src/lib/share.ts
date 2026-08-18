import type { Product } from '../types';

/**
 * Retorna a URL canônica para compartilhar diretamente uma peça.
 */
export function getProductShareUrl(productId: string): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?p=${encodeURIComponent(productId)}`;
}

export type ShareResult = 'native' | 'clipboard' | 'failed';

/**
 * Compartilha o produto usando a Web Share API (mobile/navegadores compatíveis)
 * ou copia o link diretamente para a área de transferência como fallback.
 */
export async function shareProduct(product: Product): Promise<ShareResult> {
  const url = getProductShareUrl(product.id);
  const title = `${product.name} — Camisetas Imundas`;
  const text = `Confira a camiseta "${product.name}" na Camisetas Imundas:`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return 'native';
    } catch (err: unknown) {
      // Se o usuário cancelou a gaveta nativa de compartilhamento, não é erro
      if (err instanceof Error && err.name === 'AbortError') {
        return 'failed';
      }
      // Outros erros: faz fallback para clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'clipboard';
    } catch {
      // Fallback para textarea legado se clipboard API falhar
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return 'clipboard';
      } catch {
        return 'failed';
      }
    }
  }

  return 'failed';
}
