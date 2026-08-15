/**
 * Consulta de CEP no ViaCEP.
 *
 * Fica isolado do componente porque o checkout só precisa saber em qual dos
 * três desfechos caiu — achou, não existe, ou não deu para perguntar. Cada um
 * pede uma tela diferente, e tratar "CEP inexistente" igual a "Correios fora
 * do ar" deixaria o visitante corrigindo um número que estava certo.
 */
import { onlyDigits } from './format';

export interface CepAddress {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
  /**
   * CEP único de cidade pequena: os Correios não têm rua nem bairro para ele.
   * O checkout precisa saber para abrir esses campos em vez de mostrar um
   * endereço resolvido pela metade.
   */
  generic: boolean;
}

export type CepResult =
  | { status: 'ok'; address: CepAddress }
  | { status: 'not-found' }
  | { status: 'unavailable' };

interface ViaCepResponse {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export async function fetchCep(cep: string, signal?: AbortSignal): Promise<CepResult> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return { status: 'not-found' };

  let data: ViaCepResponse;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    // 400 é o ViaCEP recusando o formato; 5xx é o serviço caído. Nenhum dos
    // dois significa que o CEP não existe.
    if (!response.ok) return { status: 'unavailable' };
    data = (await response.json()) as ViaCepResponse;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    return { status: 'unavailable' };
  }

  // O ViaCEP já devolveu `erro` como booleano e como string ao longo do tempo.
  if (data?.erro === true || data?.erro === 'true') return { status: 'not-found' };

  const city = text(data?.localidade);
  const state = text(data?.uf).toUpperCase();
  // Sem cidade e UF não há endereço utilizável, mesmo com HTTP 200.
  if (!city || state.length !== 2) return { status: 'unavailable' };

  const street = text(data?.logradouro);
  const district = text(data?.bairro);

  return {
    status: 'ok',
    address: {
      cep: digits,
      street,
      district,
      city,
      state,
      generic: !street,
    },
  };
}
