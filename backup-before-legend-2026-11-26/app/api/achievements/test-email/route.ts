import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/tubex-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] || char));
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const email = String(user.email || "").trim();
  if (!email) return NextResponse.json({ error: "account_email_not_found" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "resend_not_configured" }, { status: 503 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("creator_channel_profiles")
    .select("channel_title,subscriber_count,total_views")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "profile_read_failed" }, { status: 500 });

  const { data: latest, error: achievementError } = await supabaseAdmin
    .from("user_achievements")
    .select("achievement_code,achieved_value,unlocked_at")
    .eq("user_id", user.id)
    .order("unlocked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (achievementError) return NextResponse.json({ error: "achievement_read_failed" }, { status: 500 });
  if (!latest) return NextResponse.json({ error: "no_unlocked_achievement" }, { status: 409 });

  const { data: achievement } = await supabaseAdmin
    .from("achievement_catalog")
    .select("title,description,tier,points")
    .eq("code", latest.achievement_code)
    .maybeSingle();

  const title = escapeHtml(achievement?.title || "Conquista TubeX");
  const description = escapeHtml(achievement?.description || "Você alcançou um novo marco.");
  const channel = escapeHtml(profile?.channel_title || "Seu canal");
  const value = new Intl.NumberFormat("pt-BR").format(Number(latest.achieved_value || 0));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tubexai.com.br";
  const html = `<!doctype html><html><body style="margin:0;background:#f2f3f6;font-family:Arial,sans-serif;padding:28px 12px"><div style="max-width:600px;margin:auto;background:#171923;border-radius:24px;padding:34px;color:#fff;text-align:center"><div style="font-size:26px;font-weight:900">Tube<span style="color:#f4c542">X</span></div><p style="margin-top:34px;color:#f4c542;font-size:12px;font-weight:800;letter-spacing:3px">CONQUISTA DESBLOQUEADA</p><div style="margin:24px auto;width:150px;height:150px;border-radius:50%;background:linear-gradient(145deg,#ffe18a,#e99a25);border:8px solid #d98d1e;line-height:150px;font-size:76px;color:#68400d">★</div><h1 style="font-size:30px;line-height:1.15">${title}</h1><p style="font-size:42px;font-weight:900;color:#f4c542;margin:18px 0">${value}</p><p style="font-size:17px;color:#e3e5eb">${channel}</p><p style="color:#c6cad4;line-height:1.6">${description}</p><div style="margin-top:30px;padding:14px;border:1px solid #555967;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:1px">SUA EVOLUÇÃO MERECE SER RECONHECIDA</div><p style="margin-top:30px;color:#aeb3c2;font-size:12px">TubeX · Descubra, Otimize e Domine o YouTube</p><a href="${appUrl}/dashboard" style="display:inline-block;margin-top:10px;background:#f4c542;color:#171923;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:800">VER MINHAS CONQUISTAS</a></div></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: `Sua conquista TubeX: ${achievement?.title || "novo marco"} 🏆`, html }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: result?.message || "email_send_failed" }, { status: 502 });

  return NextResponse.json({ success: true, to: email, providerId: result?.id || null });
}
