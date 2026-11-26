"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Dados do canal conectado (YouTube Data API com o token OAuth do Google), com cache em memória. */
export type YTChannel = { id: string; title: string; thumbnail: string; subscribers: number; views: number; videoCount: number; uploads: string };
export type YTVideo = { id: string; title: string; thumbnail: string; publishedAt: string; views: number; likes: number; comments: number; durationSeconds: number; isShort: boolean };
export type ChannelData = { channel: YTChannel; videos: YTVideo[]; fetchedAt: number };

const API = "https://www.googleapis.com/youtube/v3";
const TTL = 10 * 60 * 1000;
let cache: ChannelData | null = null;
let inflight: Promise<ChannelData> | null = null;

export class NeedsGoogleError extends Error { needsGoogle = true; }

function seconds(iso: string) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}
async function yt(path: string, token: string) {
  const r = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new NeedsGoogleError(d?.error?.message || "Autorização do YouTube expirada.");
  if (!r.ok) throw new Error(d?.error?.message || `YouTube API: ${r.status}`);
  return d;
}

async function fetchChannelData(): Promise<ChannelData> {
  const { data } = await supabase.auth.getSession();
  const token = String((data.session as any)?.provider_token || "");
  if (!token) throw new NeedsGoogleError("Conecte seu canal do YouTube para ver métricas e vídeos.");
  const mine = await yt("channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50", token);
  const list: YTChannel[] = (mine.items || []).map((c: any) => ({
    id: String(c.id), title: c.snippet?.title || "Canal",
    thumbnail: c.snippet?.thumbnails?.high?.url || c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || "",
    subscribers: Number(c.statistics?.subscriberCount || 0), views: Number(c.statistics?.viewCount || 0),
    videoCount: Number(c.statistics?.videoCount || 0), uploads: String(c.contentDetails?.relatedPlaylists?.uploads || ""),
  }));
  if (!list.length) throw new Error("Nenhum canal do YouTube foi encontrado nesta conta Google.");
  let saved = ""; try { saved = localStorage.getItem("tubex-feed-channel") || ""; } catch {}
  const channel = list.find((c) => c.id === saved) || list[0];
  const ids: string[] = [];
  if (channel.uploads) {
    const p = new URLSearchParams({ part: "contentDetails", playlistId: channel.uploads, maxResults: "50" });
    const res = await yt(`playlistItems?${p}`, token);
    for (const item of res.items || []) if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
  }
  const videos: YTVideo[] = [];
  if (ids.length) {
    const p = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(",") });
    const res = await yt(`videos?${p}`, token);
    for (const v of res.items || []) {
      const dur = seconds(String(v.contentDetails?.duration || ""));
      videos.push({
        id: String(v.id), title: v.snippet?.title || "Sem título",
        thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
        publishedAt: v.snippet?.publishedAt || "", views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0), comments: Number(v.statistics?.commentCount || 0),
        durationSeconds: dur, isShort: dur > 0 && (dur <= 60 || (dur <= 180 && /#shorts?/i.test(`${v.snippet?.title} ${v.snippet?.description || ""}`))),
      });
    }
  }
  videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  try {
    localStorage.setItem("tubex-ai-channel-context", JSON.stringify({
      channelId: channel.id, channelName: channel.title, channelThumbnail: channel.thumbnail,
      subscribers: channel.subscribers, totalViews: channel.views, videoCount: channel.videoCount,
      videos: videos.slice(0, 40).map((v) => ({ title: v.title, publishedAt: v.publishedAt, views: v.views, likes: v.likes, comments: v.comments, durationSeconds: v.durationSeconds })),
      fetchedAt: new Date().toISOString(),
    }));
    window.dispatchEvent(new Event("tubex-channel-context"));
  } catch {}
  return { channel, videos, fetchedAt: Date.now() };
}

export function useChannelData() {
  const [data, setData] = useState<ChannelData | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<{ message: string; needsGoogle: boolean } | null>(null);
  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.fetchedAt < TTL) { setData(cache); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      if (!inflight || force) inflight = fetchChannelData();
      cache = await inflight; setData(cache);
    } catch (e: any) {
      setError({ message: e?.message || "Não foi possível carregar o canal.", needsGoogle: Boolean(e?.needsGoogle) });
    } finally { inflight = null; setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: () => load(true) };
}

export async function connectYouTube() {
  const { data } = await supabase.auth.getSession();
  const user: any = data.session?.user;
  const options = {
    redirectTo: `${window.location.origin}/dashboard`,
    scopes: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
    queryParams: { access_type: "offline", prompt: "consent" },
  };
  const hasGoogle = (user?.identities || []).some((i: any) => i.provider === "google");
  const result = user && !hasGoogle
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (result.error) throw result.error;
}

/** Mediana das views dos vídeos anteriores (base de comparação "x vezes sua média"). */
export function baselineFor(videos: YTVideo[], index: number, sample = 10) {
  const prior = videos.slice(index + 1).filter((v) => v.isShort === videos[index]?.isShort).slice(0, sample).map((v) => v.views).sort((a, b) => a - b);
  if (!prior.length) return 0;
  const mid = Math.floor(prior.length / 2);
  return prior.length % 2 ? prior[mid] : (prior[mid - 1] + prior[mid]) / 2;
}

export function nextMilestone(value: number) {
  const steps = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000, 1_000_000_000];
  const next = steps.find((s) => s > value) || value * 2;
  const prev = [...steps].reverse().find((s) => s <= value) || 0;
  return { prev, next, progress: next > prev ? (value - prev) / (next - prev) : 1 };
}

export const compact = (v: number) => new Intl.NumberFormat("pt-BR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v || 0);
export function ago(iso: string) {
  const d = (Date.now() - Date.parse(iso)) / 86400000;
  if (!Number.isFinite(d)) return "—";
  if (d < 1) { const h = Math.max(1, Math.round(d * 24)); return `há ${h} h`; }
  if (d < 30) return `há ${Math.round(d)} ${Math.round(d) === 1 ? "dia" : "dias"}`;
  if (d < 365) return `há ${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? "mês" : "meses"}`;
  return `há ${Math.round(d / 365)} ${Math.round(d / 365) === 1 ? "ano" : "anos"}`;
}
