import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: corsHeaders }); }

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.googleAccessToken || "").trim();
    if (!token) return NextResponse.json({ error: "Faça login no TubeX para gerar seu link." }, { status: 401, headers: corsHeaders });

    const identityResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!identityResponse.ok) return NextResponse.json({ error: "Sessão Google expirada. Entre novamente na extensão." }, { status: 401, headers: corsHeaders });
    const identity = await identityResponse.json();
    const email = String(identity?.email || "").trim().toLowerCase();
    if (!email || identity?.email_verified !== true) return NextResponse.json({ error: "Não foi possível validar o e-mail Google." }, { status: 403, headers: corsHeaders });

    let { data: user, error: lookupError } = await supabaseAdmin.from("users")
      .select("id,email,name,affiliate_code,referred_by").ilike("email", email).maybeSingle();
    if (lookupError) throw lookupError;

    if (user?.affiliate_code) {
      return NextResponse.json({ affiliate_code: user.affiliate_code, referred_by: user.referred_by || null, link: `https://www.tubexai.com.br/r/${encodeURIComponent(user.affiliate_code)}` }, { headers: corsHeaders });
    }

    const base = String(identity?.name || email.split("@")[0] || "TUBEX")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "TUBEX";

    for (let attempt = 0; attempt < 20; attempt++) {
      const code = `${base}${randomBytes(3).toString("hex").toUpperCase()}`;
      if (user) {
        const { data: updated, error } = await supabaseAdmin.from("users")
          .update({ affiliate_code: code, updated_at: new Date().toISOString() })
          .eq("id", user.id).is("affiliate_code", null).select("affiliate_code").maybeSingle();
        if (!error && updated?.affiliate_code) {
          return NextResponse.json({ affiliate_code: updated.affiliate_code, referred_by: user.referred_by || null, link: `https://www.tubexai.com.br/r/${encodeURIComponent(updated.affiliate_code)}` }, { headers: corsHeaders });
        }
        if (error && error.code !== "23505") throw error;
        const { data: latest } = await supabaseAdmin.from("users").select("affiliate_code,referred_by").eq("id", user.id).maybeSingle();
        if (latest?.affiliate_code) return NextResponse.json({ affiliate_code: latest.affiliate_code, referred_by: latest.referred_by || null, link: `https://www.tubexai.com.br/r/${encodeURIComponent(latest.affiliate_code)}` }, { headers: corsHeaders });
      } else {
        const { data: inserted, error } = await supabaseAdmin.from("users").insert({
          email, name: identity?.name || email.split("@")[0], plan: "free", status: "active", affiliate_code: code,
        }).select("affiliate_code").single();
        if (!error && inserted?.affiliate_code) {
          return NextResponse.json({ affiliate_code: inserted.affiliate_code, link: `https://www.tubexai.com.br/r/${encodeURIComponent(inserted.affiliate_code)}` }, { headers: corsHeaders });
        }
        if (error?.code === "23505") {
          const { data: latest } = await supabaseAdmin.from("users").select("id,email,name,affiliate_code,referred_by").ilike("email", email).maybeSingle();
          if (latest?.affiliate_code) return NextResponse.json({ affiliate_code: latest.affiliate_code, referred_by: latest.referred_by || null, link: `https://www.tubexai.com.br/r/${encodeURIComponent(latest.affiliate_code)}` }, { headers: corsHeaders });
          user = latest;
        } else if (error) throw error;
      }
    }
    return NextResponse.json({ error: "Não foi possível gerar o código. Tente novamente." }, { status: 409, headers: corsHeaders });
  } catch (error: any) {
    console.error("Affiliate extension-code error:", error);
    return NextResponse.json({ error: error?.message || "Falha ao gerar link de afiliado." }, { status: 500, headers: corsHeaders });
  }
}
