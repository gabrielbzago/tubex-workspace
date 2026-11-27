/**
 * TubeX AI "cérebro": entende o que o usuário pediu, monta um contexto útil do canal
 * e traz buscas reais do YouTube para tags, títulos e SEO.
 *
 * Antes o chat recebia o JSON do canal cortado em 4.000 caracteres e o mesmo prompt
 * para qualquer pergunta, com temperatura baixa. Resultado: para pedidos de tags o
 * modelo olhava só os títulos do canal e devolvia sempre a mesma lista do nicho.
 */

export type ChatIntent =
  | "tags" | "titles" | "description" | "ideas" | "script"
  | "seo" | "thumbnail" | "analysis" | "general";

type ChatMessage = { role: "user" | "assistant"; content: string };

const INTENT_RULES: [ChatIntent, RegExp][] = [
  ["tags", /\b(tags?|hashtags?|etiquetas?|marca[cç][oõ]es)\b|#\w/],
  ["titles", /\b(t[ií]tulos?|headlines?|chamadas?)\b/],
  ["description", /\b(descri[cç](?:[aã]o|[oõ]es)|description)\b/],
  ["script", /\b(roteiros?|scripts?|narra[cç][aã]o|gancho|hook|introdu[cç][aã]o do v[ií]deo)\b/],
  ["thumbnail", /\b(thumb(?:nail)?s?|miniaturas?|capas?)\b/],
  ["ideas", /\b(ideias?|pautas?|temas?|sobre o que (?:gravar|fazer)|pr[oó]ximos? v[ií]deos?|s[eé]ries?|conte[uú]dos? novos?)\b/],
  ["seo", /\b(seo|palavras?[- ]chaves?|keywords?|ranque(?:ar|amento)|busca|pesquisa|aparecer mais|otimiza(?:r|[cç][aã]o))\b/],
  ["analysis", /\b(analis[ae]|an[aá]lise|diagn[oó]stico|desempenho|performance|m[eé]tricas?|por ?que|crescer|crescimento|views?|visualiza[cç][oõ]es|inscritos|ctr|reten[cç][aã]o|m[eé]dia|compar[ae])\b/],
];

const FOLLOW_UP = /^(e\s+)?(mais|outr[ao]s?|de novo|novamente|continue|continua|refa[cç]a|melhore|melhor|diferentes?|varia[cç][oõ]es|mais op[cç][oõ]es|gere mais|manda mais|ok|sim|pode|faz|fa[cç]a)\b/;

function plain(value: string) {
  return value.toLocaleLowerCase("pt-BR");
}

function intentOf(message: string): ChatIntent {
  const value = plain(message);
  for (const [intent, rule] of INTENT_RULES) if (rule.test(value)) return intent;
  return "general";
}

/** Intenção da última mensagem; pedidos curtos como "mais" ou "outras" herdam a anterior. */
export function detectIntent(messages: ChatMessage[]): ChatIntent {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const last = users[users.length - 1] || "";
  const intent = intentOf(last);
  if (intent !== "general") return intent;
  const looksLikeFollowUp = last.length <= 60 && FOLLOW_UP.test(plain(last));
  if (looksLikeFollowUp || last.length <= 25) {
    for (let i = users.length - 2; i >= 0; i--) {
      const previous = intentOf(users[i]);
      if (previous !== "general") return previous;
    }
  }
  return intent;
}

/** Temperatura por tipo de pedido: criativo varia mais, análise fica precisa. */
export const INTENT_TEMPERATURE: Record<ChatIntent, number> = {
  tags: 0.7, titles: 0.9, description: 0.7, ideas: 0.95, script: 0.8,
  seo: 0.5, thumbnail: 0.85, analysis: 0.3, general: 0.6,
};

export const INTENT_LABEL: Record<ChatIntent, string> = {
  tags: "tags", titles: "títulos", description: "descrição", ideas: "ideias de vídeo", script: "roteiro",
  seo: "SEO e palavras-chave", thumbnail: "thumbnail", analysis: "análise de desempenho", general: "conversa geral",
};

const PLAYBOOKS: Record<ChatIntent, string> = {
  tags: `PEDIDO ATUAL: TAGS DO YOUTUBE.
- As tags são do TEMA ESPECÍFICO deste pedido (assunto que o usuário escreveu ou vídeo anexado). Nunca entregue uma lista genérica do nicho do canal nem reaproveite a mesma lista para temas diferentes.
- Se o usuário não disse o tema e não anexou vídeo, pergunte em uma frase qual é o título ou assunto do vídeo e já mostre um exemplo curto usando o vídeo mais recente do canal, dizendo qual é.
- Monte de 12 a 20 tags, somando no máximo 450 caracteres (o YouTube aceita 500):
  1. 1 a 2 tags com a palavra-chave principal exata;
  2. 4 a 6 variações de cauda longa, do jeito que o público digita na busca;
  3. 3 a 5 tags de contexto (subtema, formato, público, ano ou local quando fizer sentido);
  4. sinônimos e erros comuns de digitação só se forem buscados de verdade;
  5. nome do canal ou da série no máximo 1 vez.
- Quando houver "BUSCAS REAIS DO YOUTUBE", use as que combinam com o vídeo e diga quais vieram de lá. Não invente volume de busca.
- Se o vídeo anexado já tem tags, avalie as atuais (o que manter, o que tirar e por quê) antes de sugerir as novas.
- Entregue as tags num bloco de código \`\`\`text, separadas por vírgula e prontas para colar. Depois explique em até 4 tópicos a lógica das escolhas.
- Lembre em uma linha que título, descrição e as primeiras linhas pesam mais que as tags.
- Hashtags (#) são outra coisa: no máximo 3, só se o usuário pedir.
- Se o usuário pedir "mais" ou "outras", traga tags novas e não repita nenhuma que você já entregou nesta conversa.`,

  titles: `PEDIDO ATUAL: TÍTULOS.
- Entregue de 5 a 10 opções (ou a quantidade pedida), com até 70 caracteres cada e a palavra-chave principal no início sempre que possível.
- Varie os ângulos de verdade: curiosidade, benefício direto, número ou lista, erro ou alerta, comparação, desafio, história pessoal. Não entregue 10 variações da mesma frase.
- Aprenda com o canal: compare com os títulos que mais performaram no contexto e diga qual padrão está repetindo (ou evitando) e por quê.
- Use "BUSCAS REAIS DO YOUTUBE" quando houver, para encaixar termos que o público realmente digita.
- Mostre numa lista: título, ângulo em poucas palavras e a contagem de caracteres. Destaque uma aposta principal, sem prometer CTR ou viralização.
- Sem caixa alta exagerada, sem clickbait que o vídeo não entrega. Se pedirem mais, não repita títulos já dados.`,

  description: `PEDIDO ATUAL: DESCRIÇÃO DE VÍDEO.
- As 2 primeiras linhas (cerca de 150 caracteres) aparecem na busca: coloque a palavra-chave principal e a promessa do vídeo nelas.
- Estrutura: abertura forte, resumo em 2 a 4 frases, capítulos com minutagem só se o usuário fornecer os tempos (senão deixe marcadores [00:00] para ele preencher), chamada para ação, links como espaços reservados e no máximo 3 hashtags.
- Entregue a descrição pronta num bloco de código \`\`\`text e, fora dele, 2 ou 3 dicas curtas.`,

  ideas: `PEDIDO ATUAL: IDEIAS DE VÍDEO.
- Baseie as ideias no que já funciona no canal: cite o vídeo ou padrão do contexto que inspirou cada uma (ex.: "derivada de X, que teve 3x a mediana").
- Misture tipos: continuação de sucesso, tema próximo ainda não explorado, formato diferente (Shorts, lista, tutorial, reação, estudo de caso) e uma aposta mais ousada.
- Para cada ideia: título provisório, por que pode funcionar, formato sugerido. De 5 a 8 ideias, salvo pedido diferente.
- Não repita ideias já dadas nesta conversa e não sugira temas que o canal já gravou com o mesmo ângulo.`,

  script: `PEDIDO ATUAL: ROTEIRO.
- Gancho nos primeiros 5 a 15 segundos (o que o espectador ganha ficando), promessa clara, blocos com mudanças de ritmo a cada 30 a 60 segundos, retenção com "loops abertos" e fechamento com CTA natural.
- Escreva falas prontas para gravar, com marcações de cena ou B-roll entre colchetes.
- Ajuste duração e tom ao canal (Shorts ou vídeo longo, conforme o contexto ou o pedido).`,

  seo: `PEDIDO ATUAL: SEO E PALAVRAS-CHAVE.
- Defina a palavra-chave principal e 3 a 6 secundárias para o tema pedido, usando "BUSCAS REAIS DO YOUTUBE" quando houver.
- Mostre onde cada termo entra: título, primeiras linhas da descrição, tags, capítulos, fala no início do vídeo e nome do arquivo.
- Não invente volume de busca, concorrência ou posição no ranking. Se o usuário quiser números, indique a aba Pesquisa do TubeX.`,

  thumbnail: `PEDIDO ATUAL: THUMBNAIL.
- Proponha 2 ou 3 conceitos diferentes: elemento principal, expressão ou objeto, texto curto (até 4 palavras), contraste de cores e como conversa com o título.
- Você não vê as capas atuais. Não afirme que gerou imagem; a geração de thumbnail é um botão separado no chat.`,

  analysis: `PEDIDO ATUAL: ANÁLISE DO CANAL OU DOS VÍDEOS.
- Se houver vídeo anexado, a resposta é sobre ELE e segue esta ordem, com um título curto para cada etapa:
  1. Idade: data e hora da publicação e se é recém-lançado. Isso muda toda a leitura; vídeo recente nunca é ruim só por ter menos views totais que vídeos antigos.
  2. Ritmo: views por hora ou por dia e o VEREDITO AJUSTADO PELA IDADE (ex.: "com 30 horas tem 1,9x o que um vídeo típico do canal teria").
  3. Alcance e CTR: se houver YOUTUBE ANALYTICS com impressões e CTR, use os números reais (CTR entre 2% e 10% é a faixa comum; abaixo de 2% sugere revisar título e thumbnail). Se não houver, diga em uma linha e use o ritmo de views como sinal indireto.
  4. Retenção e engajamento: duração média e % assistido quando existirem; curtidas, comentários, compartilhamentos e inscritos ganhos em relação às views, comparados ao canal. Cite a origem do tráfego principal e o que ela indica (busca = SEO funcionando; sugeridos/início = algoritmo testando o vídeo).
  5. Diagnóstico: junte tudo numa conclusão clara (indo bem, na média ou abaixo, e por quê) e dê 3 ações concretas para este vídeo agora (ex.: fixar comentário, responder comentários, Short derivado, ajuste de título ou thumbnail só se estiver abaixo).
- Use os números do contexto: mediana, melhores vídeos, ritmo de publicação, Shorts versus longos, desempenho em relação à mediana. Cite os vídeos pelo título.
- Separe o que é fato (dado fornecido), hipótese (sua leitura) e recomendação. Termine com prioridades numeradas.
- Se faltar dado (retenção, CTR, origem de tráfego), diga que não está disponível em vez de supor.`,

  general: `PEDIDO ATUAL: CONVERSA GERAL.
- Responda exatamente o que foi perguntado, usando o contexto do canal só quando ele ajuda. Se a pergunta for vaga, responda o mais útil e faça uma pergunta curta para refinar.`,
};

export function intentPlaybook(intent: ChatIntent) {
  return PLAYBOOKS[intent];
}

const STOPWORDS = new Set((
  "a o os as um uma uns umas de do da dos das em no na nos nas por pelo pela para pra pro com sem sobre e ou que " +
  "como meu minha meus minhas seu sua seus suas esse essa este esta isso isto aquele aquela ele ela eles elas eu voce " +
  "vc voces nos me te se ao aos mais menos muito muita ja nao sim tem ter ser foi vai vou the and for you your with " +
  "how what video videos canal shorts short parte ep episodio"
).split(" "));

function words(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

const COMMAND_WORDS = /(^|\s)(me|nos|dê|dá|gere|gera|gerar|crie|cria|criar|fa[cç]a|faz|fazer|sugira|sugere|sugerir|quero|queria|preciso|manda|mande|liste|lista|escreva|escreve|monte|monta|otimize|otimizar|melhore|melhorar|pode|poderia|por favor|pfv|pf|tags?|hashtags?|t[ií]tulos?|descri[cç][aã]o|palavras?[- ]chaves?|keywords?|seo|ideias?|roteiros?|thumbnails?|thumb|capas?|boas?|bons|melhores|algumas|alguns|umas|uns|novas?|novos?|outras?|outros?|mais|op[cç][oõ]es|otimizad[oa]s?|perfeit[oa]s?|virais|viral|chamativ[oa]s?|criativ[oa]s?|meu|minha|meus|minhas|v[ií]deos?|canal|shorts?)(?=\s|$)/gi;
const EDGE_WORDS = /^(?:(?:para|pra|pro|do|da|dos|das|de|o|a|os|as|um|uma|no|na|em|sobre|com|que|e|tema|assunto)\s+)+|(?:\s+(?:para|pra|pro|do|da|de|o|a|um|uma|no|na|em|sobre|com|que|e))+$/gi;

/** Tenta extrair o assunto do pedido ("tags para um vídeo de bolo de cenoura" → "bolo de cenoura"). */
export function extractTopic(message: string): string {
  const quoted = message.match(/["“'«]([^"”'»]{3,90})["”'»]/);
  if (quoted) return quoted[1].trim();
  const after = message.match(/(?<![\p{L}\p{N}])(?:sobre|de|do|da|com o tema|tema|assunto|t[ií]tulo|chamado|intitulado)\s*[:\-]?\s+(.{3,120})$/iu);
  const base = after ? after[1] : message;
  let cleaned = ` ${base.replace(/[?!.,;:()\[\]]/g, " ")} `;
  for (let i = 0; i < 3; i++) cleaned = cleaned.replace(COMMAND_WORDS, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim().replace(EDGE_WORDS, "").trim();
  return cleaned.length >= 3 ? cleaned.slice(0, 80) : "";
}

/** Autocompletar do YouTube (mesma fonte da aba Pesquisa). Falha silenciosa e rápida. */
export async function fetchYouTubeSuggestions(topic: string, limit = 12): Promise<string[]> {
  const query = topic.trim().slice(0, 80);
  if (query.length < 3) return [];
  const variants = [query, `como ${query}`, `${query} 2026`].slice(0, query.split(" ").length > 4 ? 1 : 3);
  const results = await Promise.all(variants.map(async (q) => {
    try {
      const url = new URL("https://suggestqueries.google.com/complete/search");
      url.searchParams.set("client", "firefox");
      url.searchParams.set("ds", "yt");
      url.searchParams.set("q", q);
      url.searchParams.set("hl", "pt");
      url.searchParams.set("gl", "BR");
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 TubeX AI" }, cache: "no-store", signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return [];
      const data = await response.json().catch(() => null);
      return Array.isArray(data?.[1]) ? data[1].map((v: any) => String(v).trim()).filter(Boolean) : [];
    } catch { return []; }
  }));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of results.flat()) {
    const key = s.toLowerCase();
    if (seen.has(key) || key === query.toLowerCase()) continue;
    seen.add(key);
    out.push(s.slice(0, 80));
    if (out.length >= limit) break;
  }
  return out;
}

const n = (value: unknown) => {
  const v = Number(value);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};
const fmt = (value: number) => Math.round(value).toLocaleString("pt-BR");
const clean = (value: unknown, max: number) => String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysAgo(date: string) {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return "";
  const days = Math.max(0, Math.round((Date.now() - time) / 86_400_000));
  return days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * Resumo do canal em texto, com estatísticas já calculadas. O modelo raciocina melhor
 * sobre "3,2x a mediana" do que sobre um JSON cru e cortado no meio.
 */
export function buildChannelSummary(context: any): string {
  if (!context || typeof context !== "object" || !context.channelName) {
    return "Canal não conectado. Responda com boas práticas gerais e, quando os dados do canal fizerem diferença, sugira conectar o canal pelo Início do TubeX.";
  }
  const lines: string[] = [];
  lines.push(`Canal: ${clean(context.channelName, 100)} | ${fmt(n(context.subscribers))} inscritos | ${fmt(n(context.totalViews))} visualizações totais | ${fmt(n(context.videoCount))} vídeos publicados.`);
  if (context.description) lines.push(`Descrição do canal: ${clean(context.description, 300)}`);

  const videos = (Array.isArray(context.videos) ? context.videos : [])
    .filter((v: any) => v && typeof v.title === "string")
    .slice(0, 40)
    .map((v: any) => ({
      title: clean(v.title, 110), views: n(v.views), likes: n(v.likes), comments: n(v.comments),
      publishedAt: String(v.publishedAt || ""), duration: n(v.durationSeconds),
    }));
  if (!videos.length) {
    lines.push("Lista de vídeos não disponível neste momento.");
    return lines.join("\n");
  }

  const med = median(videos.map((v: any) => v.views)) || 1;
  const shorts = videos.filter((v: any) => v.duration > 0 && v.duration <= 180);
  const longs = videos.filter((v: any) => v.duration > 180);
  const dates = videos.map((v: any) => Date.parse(v.publishedAt)).filter(Number.isFinite).sort((a: number, b: number) => b - a);
  const spanDays = dates.length > 1 ? Math.max(1, (dates[0] - dates[dates.length - 1]) / 86_400_000) : 0;
  const perWeek = spanDays ? (dates.length / spanDays) * 7 : 0;

  lines.push(`Amostra: ${videos.length} vídeos mais recentes. Mediana: ${fmt(med)} visualizações por vídeo.` +
    (perWeek ? ` Ritmo: cerca de ${perWeek.toFixed(1).replace(".", ",")} vídeos por semana.` : "") +
    (shorts.length || longs.length ? ` Shorts: ${shorts.length} (mediana ${fmt(median(shorts.map((v: any) => v.views)))}) | Longos: ${longs.length} (mediana ${fmt(median(longs.map((v: any) => v.views)))}).` : ""));

  const freq = new Map<string, number>();
  for (const v of videos) for (const w of new Set(words(v.title))) freq.set(w, (freq.get(w) || 0) + 1);
  const themes = [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, c]) => `${w} (${c})`);
  if (themes.length) lines.push(`Termos recorrentes nos títulos: ${themes.join(", ")}.`);

  const row = (v: any) => `- "${v.title}" | ${fmt(v.views)} views (${(v.views / med).toFixed(1).replace(".", ",")}x a mediana) | ${fmt(v.likes)} curtidas | ${fmt(v.comments)} coment. | ${v.duration > 0 && v.duration <= 180 ? "Short" : "longo"} | ${daysAgo(v.publishedAt)}`;
  const top = [...videos].sort((a: any, b: any) => b.views - a.views).slice(0, 6);
  lines.push("Melhores vídeos da amostra:", ...top.map(row));
  const topTitles = new Set(top.map((v: any) => v.title));
  const recent = videos.filter((v: any) => !topTitles.has(v.title)).slice(0, 8);
  if (recent.length) lines.push("Vídeos recentes:", ...recent.map(row));
  const shown = new Set([...topTitles, ...recent.map((v: any) => v.title)]);
  const weak = [...videos].filter((v: any) => !shown.has(v.title)).sort((a: any, b: any) => a.views - b.views).slice(0, 3);
  if (videos.length >= 10 && weak.length) lines.push("Abaixo da média:", ...weak.map(row));

  return lines.join("\n").slice(0, 4200);
}

export type SelectedVideo = {
  id: string; title: string; publishedAt: string; views: number; likes: number; comments: number;
  tags: string[]; description: string;
  analytics: SelectedVideoAnalytics | null;
};

export type SelectedVideoAnalytics = {
  status: "ok" | "no_permission" | "no_data" | "error";
  views?: number; minutesWatched?: number; avgViewDuration?: number; avgViewPercentage?: number;
  subscribersGained?: number; shares?: number; impressions?: number; ctr?: number;
  trafficSources: { source: string; views: number }[];
};

function sanitizeAnalytics(input: any): SelectedVideoAnalytics | null {
  if (!input || typeof input !== "object") return null;
  const status = ["ok", "no_permission", "no_data", "error"].includes(input.status) ? input.status : "error";
  const num = (value: unknown) => (value === undefined || value === null || !Number.isFinite(Number(value)) ? undefined : Math.max(0, Number(value)));
  return {
    status,
    views: num(input.views), minutesWatched: num(input.minutesWatched), avgViewDuration: num(input.avgViewDuration),
    avgViewPercentage: num(input.avgViewPercentage), subscribersGained: num(input.subscribersGained), shares: num(input.shares),
    impressions: num(input.impressions), ctr: num(input.ctr),
    trafficSources: (Array.isArray(input.trafficSources) ? input.trafficSources : []).slice(0, 6)
      .map((t: any) => ({ source: clean(t?.source, 40).replace(/[^A-Z_]/gi, ""), views: n(t?.views) })).filter((t: any) => t.source),
  };
}

const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: "Pesquisa do YouTube", SUGGESTED_VIDEO: "Vídeos sugeridos", BROWSE: "Página inicial e inscrições",
  SHORTS: "Feed de Shorts", EXT_URL: "Sites e apps externos", NO_LINK_OTHER: "Direto ou desconhecido",
  NOTIFICATION: "Notificações", PLAYLIST: "Playlists", YT_CHANNEL: "Página do canal", YT_OTHER_PAGE: "Outras páginas do YouTube",
  SUBSCRIBER: "Inscritos", END_SCREEN: "Telas finais", HASHTAGS: "Hashtags", SOUND_PAGE: "Página de áudio",
  ANNOTATION: "Cards e anotações", CAMPAIGN_CARD: "Campanhas", ADVERTISING: "Anúncios", LIVE_REDIRECT: "Redirecionamento de live",
};

function describeAnalytics(a: SelectedVideoAnalytics | null): string[] {
  if (!a) return ["   YouTube Analytics: não consultado. CTR, retenção e origem do tráfego indisponíveis."];
  if (a.status === "no_permission") return ["   YouTube Analytics: sem permissão neste login. Diga em uma linha que, para liberar CTR, retenção e origem do tráfego, o usuário deve reconectar a conta Google no TubeX (Início > conectar canal) e aceitar a permissão de relatórios do YouTube Analytics."];
  if (a.status === "no_data") return ["   YouTube Analytics: ainda sem dados para este vídeo (o Analytics costuma ter 24 a 48 horas de atraso). Diga isso e use o ritmo de views públicas."];
  if (a.status === "error") return ["   YouTube Analytics: indisponível agora. Use os dados públicos e não invente CTR ou retenção."];
  const out = ["   YOUTUBE ANALYTICS (dados privados reais do dono do canal; podem ter 24 a 48 horas de atraso em relação às views públicas):"];
  if (a.ctr !== undefined && a.impressions !== undefined) out.push(`   - Impressões: ${fmt(a.impressions)} | CTR das impressões: ${(a.ctr * (a.ctr <= 1 && a.ctr * a.impressions <= (a.views || Infinity) * 1.5 ? 100 : 1)).toFixed(1).replace(".", ",")}%`);
  else out.push("   - CTR e impressões: não retornados pela API para este vídeo; use o ritmo de views como sinal indireto.");
  if (a.avgViewDuration !== undefined) out.push(`   - Duração média assistida: ${Math.floor(a.avgViewDuration / 60)}min${String(Math.round(a.avgViewDuration % 60)).padStart(2, "0")}s | Retenção média: ${a.avgViewPercentage !== undefined ? `${a.avgViewPercentage.toFixed(1).replace(".", ",")}% do vídeo` : "sem dado"}`);
  if (a.minutesWatched !== undefined) out.push(`   - Tempo de exibição: ${fmt(a.minutesWatched / 60)} horas | Inscritos ganhos: ${fmt(a.subscribersGained || 0)} | Compartilhamentos: ${fmt(a.shares || 0)}`);
  if (a.trafficSources.length) {
    const total = a.trafficSources.reduce((sum, t) => sum + t.views, 0) || 1;
    out.push(`   - Origem do tráfego: ${a.trafficSources.map((t) => `${TRAFFIC_LABELS[t.source] || t.source} ${Math.round((t.views / total) * 100)}%`).join(", ")}`);
  }
  return out;
}

export function sanitizeSelectedVideos(input: unknown): SelectedVideo[] {
  return (Array.isArray(input) ? input : []).slice(0, 5)
    .filter((video: any) => video && typeof video.id === "string" && typeof video.title === "string")
    .map((video: any) => ({
      id: video.id.slice(0, 32),
      title: clean(video.title, 200),
      publishedAt: String(video.publishedAt || "").slice(0, 32),
      views: Math.min(1e15, n(video.views)),
      likes: Math.min(1e15, n(video.likes)),
      comments: Math.min(1e15, n(video.comments)),
      tags: (Array.isArray(video.tags) ? video.tags : []).filter((t: any) => typeof t === "string").slice(0, 30).map((t: string) => clean(t, 50)).filter(Boolean),
      description: clean(video.description, 400),
      analytics: sanitizeAnalytics(video.analytics),
    }));
}

function ageDays(date: string) {
  const time = Date.parse(date);
  return Number.isFinite(time) ? Math.max(1, (Date.now() - time) / 86_400_000) : 0;
}

const pct = (part: number, total: number) => total > 0 ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "sem dados";
const ratio = (value: number) => value.toFixed(1).replace(".", ",");

/**
 * Descreve os vídeos anexados com o diagnóstico já calculado contra o próprio canal
 * (mediana de views, views por dia, taxa de curtidas e comentários). Sem isso o modelo
 * pequeno respondia "não tenho acesso aos dados" mesmo com os números no prompt.
 */
/**
 * Fração aproximada das views "de vida" que um vídeo costuma ter com X dias.
 * Curva logarítmica: ~17% no 1º dia, ~50% em 7 dias, ~85% em 30 dias, 100% em 60.
 * Serve para não comparar um vídeo de 2 dias com o total acumulado de vídeos antigos.
 */
function lifetimeShare(days: number) {
  if (days <= 0) return 1;
  return Math.min(1, Math.max(0.04, Math.log(1 + days) / Math.log(61)));
}

function ageText(days: number) {
  if (!days) return "em data indisponível";
  if (days < 2) return `há ${Math.max(1, Math.round(days * 24))} horas`;
  return `há ${Math.round(days)} dias`;
}

/**
 * Descreve os vídeos anexados com o diagnóstico já ajustado pela IDADE do vídeo.
 * Um vídeo novo é comparado com o que os vídeos do canal costumam ter nessa mesma
 * idade, não com o total que os antigos acumularam em meses.
 */
export function describeSelectedVideos(videos: SelectedVideo[], context?: any): string {
  if (!videos.length) return "Nenhum vídeo anexado.";
  const sample = (Array.isArray(context?.videos) ? context.videos : [])
    .filter((v: any) => v && Number.isFinite(Number(v.views)))
    .map((v: any) => ({ views: n(v.views), likes: n(v.likes), comments: n(v.comments), age: ageDays(String(v.publishedAt || "")) }));
  // Base: vídeos já "maduros" (30+ dias), cujo total representa o desempenho de vida.
  const mature = sample.filter((v: any) => v.age >= 30);
  const base = mature.length >= 3 ? mature : sample;
  const medLifetime = median(base.map((v: any) => v.views / lifetimeShare(v.age)));
  const medLikeRate = median(sample.filter((v: any) => v.views > 0).map((v: any) => v.likes / v.views));
  const medCommentRate = median(sample.filter((v: any) => v.views > 0).map((v: any) => v.comments / v.views));

  return videos.map((v, i) => {
    const age = ageDays(v.publishedAt);
    const lines = [
      `${i + 1}. "${v.title}"`,
      `   Idade: publicado ${ageText(age)}${Number.isFinite(Date.parse(v.publishedAt)) ? ` (${new Date(v.publishedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}, horário de Brasília)` : ""}${age && age < 7 ? ", RECÉM-LANÇADO" : ""}.${age && age < 2 ? ` Ritmo: cerca de ${fmt(v.views / Math.max(1, age * 24))} views por hora.` : age ? ` Ritmo médio: ${fmt(v.views / age)} views por dia.` : ""}`,
      `   Números atuais: ${fmt(v.views)} visualizações, ${fmt(v.likes)} curtidas (${pct(v.likes, v.views)} das views), ${fmt(v.comments)} comentários (${pct(v.comments, v.views)}).`,
    ];
    if (sample.length >= 3 && medLifetime > 0 && age) {
      const expected = medLifetime * lifetimeShare(age);
      const x = v.views / expected;
      const verdict = x >= 1.5 ? "ACIMA do esperado para a idade" : x <= 0.6 ? "ABAIXO do esperado para a idade" : "DENTRO do esperado para a idade";
      lines.push(`   VEREDITO AJUSTADO PELA IDADE: um vídeo típico do canal costuma ter cerca de ${fmt(expected)} views com ${ageText(age).replace("há ", "")}; este tem ${fmt(v.views)}, ou seja ${ratio(x)}x o esperado, portanto ${verdict}. (Estimativa baseada na mediana de ${base.length} vídeos do canal e na curva típica de acúmulo de views.)`);
      if (age < 7) lines.push(`   Vídeo novo (menos de 7 dias): ele ainda está acumulando views. Nunca o compare com o total de vídeos antigos; o veredito acima já considera a idade. Projeção grosseira se mantiver o desempenho: cerca de ${fmt(v.views / lifetimeShare(age))} views em 60 dias.`);
      if (medLikeRate > 0) lines.push(`   Engajamento do canal (mediana): curtidas ${pct(medLikeRate, 1)}, comentários ${pct(medCommentRate, 1)} das views. Este vídeo: curtidas ${pct(v.likes, v.views)}, comentários ${pct(v.comments, v.views)}.`);
    } else {
      lines.push("   Sem lista de vídeos do canal para comparar; avalie pelo ritmo de views considerando a idade e pelo engajamento.");
    }
    lines.push(...describeAnalytics(v.analytics));
    lines.push(`   Tags atuais: ${v.tags.length ? v.tags.join(", ") : "nenhuma ou não informadas"}`);
    if (v.description) lines.push(`   Início da descrição: ${v.description}`);
    return lines.join("\n");
  }).join("\n");
}
