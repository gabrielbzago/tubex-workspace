import { NextResponse } from "next/server";
import { normalizeTubeXItems } from "@/lib/tubex-seo-engine";
import { callTubeXBackend, getAuthenticatedPlan, getAuthenticatedUser } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const norm = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const viewsOf = (video: any) => Number(video?.statistics?.viewCount || video?.viewCount || 0);
const titleOf = (video: any) => String(video?.snippet?.title || video?.title || "Sem título");

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sessão inválida. Entre novamente no TubeX." }, { status: 401 });

  try {
    const body = await request.json();
    const niche = String(body?.niche || "").trim().replace(/\s+/g, " ").slice(0, 120);
    const ownChannelId = String(body?.channelId || "").slice(0, 100);
    const ownTitles = Array.isArray(body?.ownTitles) ? body.ownTitles.slice(0, 12).map((v: any) => String(v || "").slice(0, 120)) : [];
    if (niche.length < 2) return NextResponse.json({ error: "Informe o nicho para encontrar vídeos fora da curva." }, { status: 400 });

    const plan = await getAuthenticatedPlan(user.id, user.email);
    const isExpert = ["expert", "owner", "admin", "administrator"].includes(plan);
    const isPro = isExpert || plan === "pro" || plan === "member";
    const seeds = [...new Set([niche, `${niche} dicas`, `como ${niche}`, ...ownTitles.slice(0, 2)].map(v => v.trim()).filter(Boolean))].slice(0, isExpert ? 4 : isPro ? 3 : 2);
    const searchResults = await Promise.all(seeds.map(async keyword => {
      try {
        return await callTubeXBackend("/youtube", { keyword, plan, includeStats: true });
      } catch (error) {
        console.warn("TubeX Outliers search failed:", keyword, error);
        return null;
      }
    }));

    const videoMap = new Map<string, any>();
    for (const result of searchResults) {
      for (const video of normalizeTubeXItems(result)) {
        const id = String(video.id || "");
        const channelId = String(video.snippet?.channelId || "");
        if (!id || !channelId || channelId === ownChannelId || !video.snippet?.title) continue;
        const previous = videoMap.get(id);
        if (!previous || viewsOf(video) > viewsOf(previous)) videoMap.set(id, video);
      }
    }

    const videos = [...videoMap.values()];
    if (!videos.length) return NextResponse.json({ success: true, items: [], message: "O backend não encontrou vídeos suficientes para esse nicho. Tente uma expressão mais específica." });

    const channelMap = new Map<string, { channelId: string; title: string; thumbnail: string; videoIds: string[]; searchViews: number }>();
    for (const video of videos) {
      const channelId = String(video.snippet.channelId);
      if (!channelMap.has(channelId)) channelMap.set(channelId, {
        channelId,
        title: String(video.snippet.channelTitle || "Canal"),
        thumbnail: String(video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || ""),
        videoIds: [], searchViews: 0,
      });
      const channel = channelMap.get(channelId)!;
      channel.videoIds.push(String(video.id));
      channel.searchViews += viewsOf(video);
    }

    const maxChannels = isExpert ? 18 : isPro ? 10 : 5;
    const channels = [...channelMap.values()].sort((a, b) => (b.videoIds.length * 100000 + b.searchViews) - (a.videoIds.length * 100000 + a.searchViews)).slice(0, maxChannels);
    const channelDetails = new Map<string, { subscribers: number | null; avgViews: number; channelViews: number; videoCount: number; recentVideos: any[] }>();
    const queue = [...channels];
    const worker = async () => {
      while (queue.length) {
        const candidate = queue.shift();
        if (!candidate) return;
        try {
          const data = await callTubeXBackend("/youtube-channel", { channelId: candidate.channelId });
          const channel = data?.data?.channel || data?.channel || {};
          const metrics = data?.data?.metrics || data?.metrics || {};
          const recentVideos = data?.data?.videos || data?.videos || [];
          const stats = channel?.statistics || {};
          const recent = Array.isArray(recentVideos) ? recentVideos.slice(0, 30) : [];
          const avg = Number(metrics.avgViews || metrics.averageViews || (recent.length ? recent.reduce((sum: number, video: any) => sum + viewsOf(video), 0) / recent.length : 0));
          channelDetails.set(candidate.channelId, {
            subscribers: stats.hiddenSubscriberCount ? null : (Number(stats.subscriberCount ?? channel?.subscriberCount) || null),
            avgViews: Math.max(0, avg),
            channelViews: Number(stats.viewCount || channel?.viewCount || 0),
            videoCount: Number(stats.videoCount || channel?.videoCount || recent.length || 0),
            recentVideos: recent,
          });
        } catch (error) {
          console.warn("TubeX Outliers channel enrichment failed:", candidate.channelId, error);
          channelDetails.set(candidate.channelId, { subscribers: null, avgViews: 0, channelViews: 0, videoCount: 0, recentVideos: [] });
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    const enriched = videos.map(video => {
      const channelId = String(video.snippet.channelId);
      const channel = channelMap.get(channelId);
      const details = channelDetails.get(channelId);
      const views = viewsOf(video);
      const avgViews = Number(details?.avgViews || 0);
      return {
        id: String(video.id),
        title: titleOf(video),
        views,
        likes: Number(video.statistics?.likeCount || 0),
        comments: Number(video.statistics?.commentCount || 0),
        publishedAt: String(video.snippet?.publishedAt || ""),
        thumbnail: String(video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || channel?.thumbnail || ""),
        channelId,
        channelTitle: String(video.snippet?.channelTitle || channel?.title || "Canal"),
        subscribers: details?.subscribers ?? null,
        channelAvgViews: avgViews,
        ratio: avgViews > 0 ? views / avgViews : 0,
        comparisonBasis: avgViews > 0 ? "channel-average" : "not-available",
        channelViews: details?.channelViews || 0,
        channelVideoCount: details?.videoCount || 0,
      };
    });

    // Only report outlier multiples where a genuine channel baseline was returned by /youtube-channel.
    const ranked = enriched.filter(item => item.comparisonBasis === "channel-average" && item.channelAvgViews > 0)
      .map(item => ({ ...item, multiple: Math.round(item.ratio * 100) / 100 }))
      .sort((a, b) => b.multiple - a.multiple || b.views - a.views)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      items: ranked,
      analyzedVideos: videos.length,
      enrichedChannels: channelDetails.size,
      message: ranked.length
        ? `${ranked.length} vídeos comparados com a média real de visualizações dos respectivos canais, obtida pelo backend TubeX.`
        : "O backend retornou vídeos, mas não forneceu médias de visualizações dos canais para calcular múltiplos confiáveis. Atualize a consulta mais tarde.",
      source: "tubex-backend-youtube-and-youtube-channel",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const status = Number(error?.status) || (String(error?.message || "").includes("TUBEX_BACKEND_API_KEY") ? 503 : 502);
    return NextResponse.json({ error: error?.message || "Não foi possível calcular os Content Outliers." }, { status });
  }
}
