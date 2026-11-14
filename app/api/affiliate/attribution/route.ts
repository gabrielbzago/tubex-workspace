import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user?.id) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = String(body?.affiliateCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,40}$/.test(code)) return NextResponse.json({ ok: true, attributed: false });
  if (!authData.user.email) return NextResponse.json({ error: "Conta sem e-mail autenticado." }, { status: 400 });
  const { data: profile, error: profileError } = await supabaseAdmin.from("users").select("id,email,referred_by").ilike("email", authData.user.email).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (profile.referred_by) return NextResponse.json({ ok: true, attributed: true, preserved: true });
  const { data: affiliate, error: affiliateError } = await supabaseAdmin.from("users").select("affiliate_code,email").eq("affiliate_code", code).maybeSingle();
  if (affiliateError) return NextResponse.json({ error: affiliateError.message }, { status: 500 });
  if (!affiliate || String(affiliate.email || "").toLowerCase() === String(profile.email || authData.user.email || "").toLowerCase()) return NextResponse.json({ ok: true, attributed: false });
  const { error } = await supabaseAdmin.from("users").update({ referred_by: code, updated_at: new Date().toISOString() }).eq("id", profile.id).is("referred_by", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, attributed: true });
}
