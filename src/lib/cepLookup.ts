export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function lookupCep(
  rawCep: string,
  signal?: AbortSignal
): Promise<CepLookupResult | null> {
  const digits = rawCep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (res.ok) {
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data && !data.erro && data.localidade && data.uf) {
        return {
          cep: digits,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade,
          state: data.uf.toUpperCase(),
        };
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, { signal });
    if (res.ok) {
      const data = (await res.json()) as {
        street?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
      };
      if (data && data.city && data.state) {
        return {
          cep: digits,
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city,
          state: data.state.toUpperCase(),
        };
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  return null;
}
