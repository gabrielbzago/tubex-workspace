import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user;
}

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  if (!authUser.email) return NextResponse.json({ error: "Conta sem e-mail autenticado." }, { status: 400 });
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,email,name,affiliate_code,affiliate_balance,affiliate_paid,cpf,pix_type,pix_key")
    .ilike("email", authUser.email)
    .maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Perfil TubeX não encontrado para esta conta." }, { status: 404 });

  if (!user.affiliate_code) {
    return NextResponse.json({ user, sales: [], clicks: 0 });
  }

  const [salesResult, clicksResult] = await Promise.all([
    supabaseAdmin.from("affiliate_sales")
      .select("id,commission_amount,commission,status,created_at,amount,stripe_invoice_id")
      .eq("affiliate_code", user.affiliate_code)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin.from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_code", user.affiliate_code),
  ]);

  if (salesResult.error) return NextResponse.json({ error: salesResult.error.message }, { status: 500 });
  if (clicksResult.error) return NextResponse.json({ error: clicksResult.error.message }, { status: 500 });

  return NextResponse.json({ user, sales: salesResult.data || [], clicks: clicksResult.count || 0 });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  if (!authUser.email) return NextResponse.json({ error: "Conta sem e-mail autenticado." }, { status: 400 });
  const { data: user, error: userError } = await supabaseAdmin
    .from("users").select("id,email,name,affiliate_code").ilike("email", authUser.email).maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Perfil TubeX não encontrado." }, { status: 404 });
  if (user.affiliate_code) return NextResponse.json({ affiliate_code: user.affiliate_code });

  const base = String(user.name || user.email || "TUBEX")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "TUBEX";

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${base}${randomBytes(3).toString("hex").toUpperCase()}`;
    const { data: updated, error } = await supabaseAdmin
      .from("users").update({ affiliate_code: candidate, updated_at: new Date().toISOString() })
      .eq("id", user.id).is("affiliate_code", null)
      .select("affiliate_code").maybeSingle();

    if (!error && updated?.affiliate_code) return NextResponse.json({ affiliate_code: updated.affiliate_code });
    if (error && !String(error.code || "").includes("23505")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: current } = await supabaseAdmin.from("users").select("affiliate_code").eq("id", user.id).maybeSingle();
    if (current?.affiliate_code) return NextResponse.json({ affiliate_code: current.affiliate_code });
  }

  return NextResponse.json({ error: "Não foi possível reservar um código único. Tente novamente." }, { status: 409 });
}
