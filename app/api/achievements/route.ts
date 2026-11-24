import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError("unauthorized", 401);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("creator_channel_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (profileError) return jsonError(`profile_read_failed: ${profileError.message}`, 500);

  const channelId = profile?.channel_id || "";
  const [catalogResult, unlockedResult, historyResult, goalsResult, preferencesResult] = await Promise.all([
    supabaseAdmin.from("achievement_catalog").select("*").eq("active", true).order("category").order("threshold"),
    channelId ? supabaseAdmin.from("user_achievements").select("achievement_code,unlocked_at,achieved_value,evidence").eq("user_id", user.id).eq("channel_id", channelId).order("unlocked_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    channelId ? supabaseAdmin.from("channel_metric_history").select("snapshot_date,subscriber_count,total_views,video_count").eq("user_id", user.id).eq("channel_id", channelId).order("snapshot_date", { ascending: false }).limit(60) : Promise.resolve({ data: [], error: null }),
    channelId ? supabaseAdmin.from("achievement_goals").select("*").eq("user_id", user.id).eq("channel_id", channelId).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("achievement_preferences").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const failed = [catalogResult, unlockedResult, historyResult, goalsResult, preferencesResult].find((result: any) => result?.error);
  if (failed?.error) return jsonError(`achievement_read_failed: ${failed.error.message}`, 500);

  const metrics = profile ? {
    subscriber_count: Number(profile.subscriber_count || 0),
    total_views: Number(profile.total_views || 0),
    video_count: Number(profile.video_count || 0),
    channel_title: profile.channel_title,
    channel_thumbnail: profile.channel_thumbnail,
    last_synced_at: profile.last_synced_at,
  } : null;

  let cohort: any = null;
  if (profile?.subscriber_count !== undefined) {
    try {
      const today = saoPauloDate();
      const { data: sample } = await supabaseAdmin
        .from("tubex_channel_view_snapshots")
        .select("channel_id,subscriber_count")
        .eq("snapshot_date", today)
        .limit(2000);
      const bands = [
        { key: "Iniciante", min: 0, max: 999 },
        { key: "Em crescimento", min: 1000, max: 4999 },
        { key: "Intermediário", min: 5000, max: 9999 },
        { key: "Consolidado", min: 10000, max: 49999 },
        { key: "Avançado", min: 50000, max: 99999 },
        { key: "Grande", min: 100000, max: 499999 },
        { key: "Referência", min: 500000, max: 999999 },
        { key: "Elite", min: 1000000, max: Number.MAX_SAFE_INTEGER },
      ];
      const currentSubs = Number(profile.subscriber_count || 0);
      const band = bands.find(item => currentSubs >= item.min && currentSubs <= item.max) || bands[0];
      const cohortValues = (sample || [])
        .filter((item: any) => item.channel_id !== profile.channel_id)
        .map((item: any) => Number(item.subscriber_count || 0))
        .filter((value: number) => value >= band.min && value <= band.max);
      const belowOrEqual = cohortValues.filter((value: number) => value <= currentSubs).length;
      cohort = {
        band: band.key,
        sample_size: cohortValues.length,
        percentile: cohortValues.length >= 10 ? Math.round((belowOrEqual / cohortValues.length) * 100) : null,
        source: "tubex_public_channel_sample",
        disclaimer: "Amostra de canais públicos acompanhados pelo TubeX; não representa todos os canais do YouTube.",
      };
    } catch {
      cohort = null;
    }
  }

  const unlocked = unlockedResult.data || [];
  const unlockedMap = new Map(unlocked.map((item: any) => [item.achievement_code, item]));
  const achievements = (catalogResult.data || []).map((item: any) => ({
    ...item,
    unlocked: unlockedMap.has(item.code),
    unlocked_at: (unlockedMap.get(item.code) as any)?.unlocked_at || null,
    achieved_value: (unlockedMap.get(item.code) as any)?.achieved_value ?? null,
    progress: metrics ? Math.min(100, Math.round((Number(metrics[item.metric as keyof typeof metrics] || 0) / Math.max(1, Number(item.threshold))) * 100)) : 0,
    current_value: metrics ? Number(metrics[item.metric as keyof typeof metrics] || 0) : 0,
  }));

  return NextResponse.json({
    success: true,
    profile: metrics,
    cohort,
    achievements,
    history: historyResult.data || [],
    goals: goalsResult.data || [],
    preferences: preferencesResult.data || { email_enabled: true, weekly_digest_enabled: true, important_email_enabled: true },
    points: unlocked.reduce((sum: number, item: any) => sum + Number((catalogResult.data || []).find((a: any) => a.code === item.achievement_code)?.points || 0), 0),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError("unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  if (body.action === "save_preferences") {
    const preferences = {
      user_id: user.id,
      email_enabled: body.email_enabled !== false,
      weekly_digest_enabled: body.weekly_digest_enabled !== false,
      important_email_enabled: body.important_email_enabled !== false,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("achievement_preferences").upsert(preferences, { onConflict: "user_id" });
    if (error) return jsonError(`preferences_save_failed: ${error.message}`, 500);
    return NextResponse.json({ success: true });
  }

  if (body.action === "create_goal") {
    const metric = String(body.metric || "");
    const title = String(body.title || "").trim().slice(0, 100);
    const target = Number(body.target_value);
    if (!["subscriber_count", "total_views", "video_count"].includes(metric) || !title || !Number.isSafeInteger(target) || target < 1) {
      return jsonError("invalid_goal");
    }
    const { data: profile } = await supabaseAdmin.from("creator_channel_profiles").select("channel_id,subscriber_count,total_views,video_count").eq("user_id", user.id).maybeSingle();
    if (!profile?.channel_id) return jsonError("connect_youtube_channel_first", 409);
    const { error } = await supabaseAdmin.from("achievement_goals").insert({
      user_id: user.id, channel_id: profile.channel_id, metric, title, target_value: target,
      baseline_value: Number(profile[metric as keyof typeof profile] || 0),
      current_value: Number(profile[metric as keyof typeof profile] || 0),
    });
    if (error) return jsonError(`goal_create_failed: ${error.message}`, 500);
    return NextResponse.json({ success: true });
  }

  if (body.action !== "sync_channel") return jsonError("unsupported_action");
  const accessToken = String(body.accessToken || "").trim();
  const requestedChannelId = String(body.channelId || "").trim();
  if (!accessToken) return jsonError("youtube_authorization_required", 401);

  const channelQuery = requestedChannelId ? `id=${encodeURIComponent(requestedChannelId)}` : "mine=true";
  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&" + channelQuery, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  const channelPayload = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok) return jsonError(channelPayload?.error?.message || "youtube_channel_fetch_failed", channelResponse.status);
  const channel = (channelPayload.items || [])[0];
  if (!channel?.id) return jsonError("channel_not_found_or_not_authorized", 404);

  const stats = channel.statistics || {};
  const metrics = {
    subscriber_count: Math.max(0, Number(stats.subscriberCount || 0)),
    total_views: Math.max(0, Number(stats.viewCount || 0)),
    video_count: Math.max(0, Number(stats.videoCount || 0)),
  };
  const snapshotDate = saoPauloDate();
  const profile = {
    user_id: user.id,
    channel_id: channel.id,
    channel_title: String(channel.snippet?.title || "Canal").slice(0, 200),
    channel_thumbnail: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || null,
    ...metrics,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabaseAdmin.from("creator_channel_profiles").upsert(profile, { onConflict: "user_id" });
  if (profileError) return jsonError(`profile_save_failed: ${profileError.message}`, 500);

  const { error: historyError } = await supabaseAdmin.from("channel_metric_history").upsert({
    user_id: user.id, channel_id: channel.id, snapshot_date: snapshotDate, ...metrics, source: "youtube_data_api",
  }, { onConflict: "user_id,channel_id,snapshot_date" });
  if (historyError) return jsonError(`history_save_failed: ${historyError.message}`, 500);

  const { data: catalog, error: catalogError } = await supabaseAdmin.from("achievement_catalog").select("*").eq("active", true);
  if (catalogError) return jsonError(`catalog_read_failed: ${catalogError.message}`, 500);

  const metricMap: Record<string, number> = metrics;
  const newlyUnlocked: any[] = [];
  for (const achievement of catalog || []) {
    const value = Number(metricMap[achievement.metric] || 0);
    if (value < Number(achievement.threshold)) continue;
    const { data: inserted, error } = await supabaseAdmin.from("user_achievements").upsert({
      user_id: user.id, channel_id: channel.id, achievement_code: achievement.code,
      achieved_value: value, evidence: { source: "youtube_data_api", snapshot_date: snapshotDate, threshold: achievement.threshold },
    }, { onConflict: "user_id,channel_id,achievement_code", ignoreDuplicates: true }).select("id,achievement_code").maybeSingle();
    if (error) console.warn("[TubeX achievements] unlock failed", achievement.code, error.message);
    if (inserted?.id) newlyUnlocked.push(achievement);
  }

  // Keep goal progress in sync with the same verified public metrics.
  const { data: goals } = await supabaseAdmin.from("achievement_goals").select("*").eq("user_id", user.id).eq("channel_id", channel.id).eq("status", "active");
  for (const goal of goals || []) {
    const current = Number(metricMap[goal.metric] || 0);
    const completed = current >= Number(goal.target_value);
    await supabaseAdmin.from("achievement_goals").update({
      current_value: current, status: completed ? "completed" : "active",
      completed_at: completed ? new Date().toISOString() : null,
    }).eq("id", goal.id);
  }

  // All new achievements enter the weekly digest. Important milestones also trigger
  // one immediate message when the creator has explicitly kept that preference enabled.
  if (newlyUnlocked.length && user.email) {
    const { data: preferences } = await supabaseAdmin.from("achievement_preferences").select("*").eq("user_id", user.id).maybeSingle();
    const digestRows = newlyUnlocked.map((item: any) => ({
      user_id: user.id, email: user.email || "", kind: "achievement_digest_item",
      achievement_code: item.code, status: "pending",
    }));
    await supabaseAdmin.from("achievement_email_logs").insert(digestRows);

    const important = newlyUnlocked.filter((item: any) => item.importance === "important");
    const resendKey = process.env.RESEND_API_KEY || "";
    const from = process.env.RESEND_FROM_EMAIL || "";
    if (important.length && preferences?.email_enabled !== false && preferences?.important_email_enabled !== false && resendKey && from) {
      for (const item of important) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from, to: [user.email],
              subject: `Conquista desbloqueada: ${item.title} · TubeX`,
              html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#171923"><div style="background:#171923;color:#f5c84c;padding:20px;border-radius:14px;font-size:22px;font-weight:800">TubeX · Conquistas</div><p style="color:#b18419;font-weight:700;margin-top:28px">NOVA CONQUISTA</p><h1>${String(item.title).replace(/[&<>"']/g, (c: string) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c] || c))}</h1><p>${String(item.description).replace(/[&<>"']/g, (c: string) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c] || c))}</p><p>Seu progresso foi registrado no TubeX. Continue avançando em direção à próxima meta!</p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://tubex.app.br"}/dashboard" style="display:inline-block;background:#f5c84c;color:#171923;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ver minhas conquistas</a></div>`,
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.message || `resend_http_${response.status}`);
          await supabaseAdmin.from("achievement_email_logs").insert({ user_id: user.id, email: user.email, kind: "important_achievement", status: "sent", provider_id: result?.id || null });
        } catch (mailError: any) {
          await supabaseAdmin.from("achievement_email_logs").insert({ user_id: user.id, email: user.email, kind: "important_achievement", status: "failed", error: String(mailError?.message || mailError).slice(0, 500) });
        }
      }
    }
  }

  return NextResponse.json({
    success: true, channel: { id: channel.id, title: profile.channel_title, thumbnail: profile.channel_thumbnail },
    metrics, newlyUnlocked: newlyUnlocked.map((item: any) => ({ code: item.code, title: item.title, tier: item.tier })),
    syncedAt: profile.last_synced_at,
  });
}
