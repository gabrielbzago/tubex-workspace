/**
 * Pacotes de créditos avulsos do TubeX AI (compra única, não é assinatura).
 * Arquivo sem dependências de servidor: pode ser importado pelo chat e pelas rotas.
 *
 * Preço sempre mais caro por crédito que o plano, para o upgrade continuar
 * sendo a melhor opção para quem usa muito:
 *   Pro    2.000 créd./mês por R$ 29,99  → R$ 0,015 por crédito
 *   Expert 6.000 créd./mês por R$ 49,99  → R$ 0,008 por crédito
 *
 * Price IDs são opcionais. Sem STRIPE_PRICE_AI_PACK_* o checkout cria o preço
 * na hora (price_data) com o valor abaixo. Se você criar os Prices na Stripe,
 * o valor cadastrado lá precisa ser o MESMO daqui (o webhook confere).
 */
export type AICreditPack = {
  id: "pack_300" | "pack_1000" | "pack_3000";
  name: string;
  credits: number;
  amountCents: number;
  currency: "brl";
  highlight?: string;
  envPriceKey: string;
};

export const AI_CREDIT_PACKS: AICreditPack[] = [
  { id: "pack_300", name: "Pacote Essencial", credits: 300, amountCents: 990, currency: "brl", envPriceKey: "STRIPE_PRICE_AI_PACK_300" },
  { id: "pack_1000", name: "Pacote Criador", credits: 1000, amountCents: 2490, currency: "brl", highlight: "Mais escolhido", envPriceKey: "STRIPE_PRICE_AI_PACK_1000" },
  { id: "pack_3000", name: "Pacote Estúdio", credits: 3000, amountCents: 5990, currency: "brl", highlight: "Melhor valor", envPriceKey: "STRIPE_PRICE_AI_PACK_3000" },
];

export function findCreditPack(id: unknown) {
  return AI_CREDIT_PACKS.find(pack => pack.id === String(id || "").trim()) || null;
}

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Próximo plano sugerido no upgrade, com a franquia mensal dele. */
export const AI_UPGRADE_PATH: Record<string, { plan: string; label: string; credits: number } | null> = {
  free: { plan: "pro", label: "Pro", credits: 2000 },
  start: { plan: "pro", label: "Pro", credits: 2000 },
  member: { plan: "expert", label: "Expert", credits: 6000 },
  pro: { plan: "expert", label: "Expert", credits: 6000 },
  expert: null,
  owner: null,
};
