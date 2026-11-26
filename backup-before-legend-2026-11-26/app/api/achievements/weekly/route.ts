import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM_EMAIL || "";
  if (!apiKey || !from) {
    return NextResponse.json({ success: false, error: "resend_environment_missing" }, { status: 500 });
  }

  const { data: pending, error } = await supabaseAdmin
    .from("achievement_email_logs")
    .select("id,user_id,email,kind,achievement_code,created_at")
    .eq("kind", "achievement_digest_item").eq("status", "pending")
    .order("created_at", { ascending: true }).limit(500);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const grouped = new Map<string, any[]>();
  for (const item of pending || []) {
    if (!item.email) continue;
    grouped.set(item.user_id, [...(grouped.get(item.user_id) || []), item]);
  }

  let sent = 0;
  let skipped = 0;
  for (const [userId, items] of grouped) {
    const { data: prefs } = await supabaseAdmin.from("achievement_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (prefs?.email_enabled === false || prefs?.weekly_digest_enabled === false) {
      await supabaseAdmin.from("achievement_email_logs").update({ status: "skipped", error: "email_preferences_disabled" }).in("id", items.map(x => x.id));
      skipped += items.length;
      continue;
    }

    const { data: profile } = await supabaseAdmin.from("creator_channel_profiles").select("channel_title,subscriber_count,total_views,video_count").eq("user_id", userId).maybeSingle();
    const codes = [...new Set(items.map(x => String(x.achievement_code || "")).filter(Boolean))];
    const { data: achievements } = await supabaseAdmin.from("achievement_catalog").select("code,title,description,tier,points").in("code", codes);
    const list = (achievements || []).map(a => `<li style="margin:10px 0"><strong>${escapeHtml(a.title)}</strong><br><span style="color:#687080">${escapeHtml(a.description)}</span></li>`).join("");
    const safeChannel = escapeHtml(profile?.channel_title || "seu canal");
    const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#171923"><div style="max-width:600px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:#171923;padding:24px;color:#f5c84c;font-weight:800;font-size:24px">TubeX <span style="color:#fff">Conquistas</span></div><div style="padding:28px"><p style="color:#b18419;font-weight:700;letter-spacing:1px">SEU RESUMO DA SEMANA</p><h1 style="font-size:26px">Sua evolução merece ser comemorada!</h1><p>Confira as conquistas recentes de <strong>${safeChannel}</strong>.</p><ul style="padding-left:20px">${list}</ul><div style="background:#f7f7f8;border-radius:12px;padding:16px;margin:22px 0"><strong>Seu canal agora</strong><p>Inscritos: ${Number(profile?.subscriber_count || 0).toLocaleString("pt-BR")}<br>Visualizações: ${Number(profile?.total_views || 0).toLocaleString("pt-BR")}<br>Vídeos: ${Number(profile?.video_count || 0).toLocaleString("pt-BR")}</p></div><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "https://tubex.app.br")}/dashboard" style="display:inline-block;background:#f5c84c;color:#171923;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:700">Ver minhas conquistas</a><p style="font-size:12px;color:#858b98;margin-top:28px">Você recebe este resumo conforme suas preferências de notificações do TubeX.</p></div></div></body></html>`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [items[0].email], subject: `Seu resumo semanal de conquistas TubeX`, html }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || `resend_http_${response.status}`);
      await supabaseAdmin.from("achievement_email_logs").update({ status: "sent", provider_id: result?.id || null, error: null }).in("id", items.map(x => x.id));
      await supabaseAdmin.from("achievement_preferences").upsert({ user_id: userId, last_digest_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      sent += 1;
    } catch (err: any) {
      await supabaseAdmin.from("achievement_email_logs").update({ status: "failed", error: String(err?.message || err).slice(0, 500) }).in("id", items.map(x => x.id));
    }
  }

  return NextResponse.json({ success: true, recipientsSent: sent, itemsSkipped: skipped, pendingUsers: grouped.size });
}

function escapeHtml(value: string) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
