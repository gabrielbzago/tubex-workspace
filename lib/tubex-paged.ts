import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * O Supabase (PostgREST) devolve no máximo 1.000 linhas por requisição, mesmo
 * quando o código pede `.limit(20000)`. Com a consulta ordenada do mais recente
 * para o mais antigo, os eventos de hoje ocupavam essas 1.000 linhas e os dias
 * anteriores apareciam zerados nos gráficos. Este helper busca todas as páginas.
 */
const PAGE = 1000;

type Builder = (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>;

export async function fetchAllPages(
  build: Builder,
  options: { maxRows?: number; concurrency?: number; total?: number | null } = {},
): Promise<{ rows: any[]; error: string | null; truncated: boolean }> {
  const maxRows = options.maxRows ?? 200_000;
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const rows: any[] = [];

  // Quando já sabemos o total, buscamos várias páginas em paralelo.
  if (typeof options.total === "number") {
    const total = Math.min(options.total, maxRows);
    const starts: number[] = [];
    for (let from = 0; from < total; from += PAGE) starts.push(from);
    for (let i = 0; i < starts.length; i += concurrency) {
      const batch = await Promise.all(starts.slice(i, i + concurrency).map((from) => build(from, from + PAGE - 1)));
      for (const result of batch) {
        if (result.error) return { rows, error: result.error.message, truncated: false };
        rows.push(...(result.data || []));
      }
    }
    return { rows, error: null, truncated: options.total > maxRows };
  }

  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, error: error.message, truncated: false };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: true };
}

/** Todos os eventos a partir de `sinceIso`, em ordem estável (mais recente primeiro). */
export async function fetchEventsSince(
  sinceIso: string,
  columns: string,
  filter?: (query: any) => any,
  maxRows = 200_000,
) {
  const base = () => {
    let q: any = supabaseAdmin.from("tubex_events").select(columns).gte("created_at", sinceIso);
    if (filter) q = filter(q);
    return q;
  };
  let total: number | null = null;
  try {
    let countQuery: any = supabaseAdmin.from("tubex_events").select("id", { count: "exact", head: true }).gte("created_at", sinceIso);
    if (filter) countQuery = filter(countQuery);
    const { count, error } = await countQuery;
    if (!error && typeof count === "number") total = count;
  } catch { /* cai na paginação sequencial */ }
  return fetchAllPages(
    (from, to) => base().order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    { maxRows, total },
  );
}

/** Tabela inteira (ou filtrada) paginada; útil para users e installations. */
export async function fetchTable(table: string, columns: string, orderBy?: string, maxRows = 100_000) {
  return fetchAllPages((from, to) => {
    let q: any = supabaseAdmin.from(table).select(columns);
    if (orderBy) q = q.order(orderBy, { ascending: false });
    return q.range(from, to);
  }, { maxRows });
}
