export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/tubex-backend";

async function authenticated(request: Request) {
  return await getAuthenticatedUser(request);
}

export async function GET(request: Request) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id,name,email,affiliate_code,affiliate_balance,affiliate_paid,cpf,pix_type,pix_key")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("[Affiliate] profile read:", profileError);
    return NextResponse.json({ error: "Não foi possível carregar seu perfil de afiliado." }, { status: 500 });
  }

  const code = String(profile.affiliate_code || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ user: profile, sales: [], clicks: 0 }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const [salesResult, clicksResult] = await Promise.all([
    supabaseAdmin.from("affiliate_sales")
      .select("id,commission_amount,commission,status,created_at,last_payment_date,plan")
      .ilike("affiliate_code", code)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .ilike("affiliate_code", code),
  ]);

  if (salesResult.error || clicksResult.error) {
    console.error("[Affiliate] stats read:", salesResult.error || clicksResult.error);
    return NextResponse.json({ error: "Não foi possível carregar os dados de desempenho." }, { status: 500 });
  }

  return NextResponse.json({
    user: profile,
    sales: salesResult.data || [],
    clicks: clicksResult.count || 0,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  // The database RPC locks the user's row. Concurrent requests cannot create
  // multiple codes, and a code already assigned to this account is never replaced.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `TX${randomBytes(5).toString("hex").toUpperCase()}`;
    const { data, error } = await supabaseAdmin.rpc("generate_tubex_affiliate_code_once", {
      p_user_id: user.id,
      p_code: candidate,
    });

    if (error) {
      console.error("[Affiliate] code generation:", error);
      return NextResponse.json({ error: "Não foi possível gerar seu código agora. Tente novamente." }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    const assigned = String(result?.affiliate_code || "").trim().toUpperCase();
    if (assigned) {
      return NextResponse.json({
        success: true,
        affiliate_code: assigned,
        created: Boolean(result.created),
        locked: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    // Null means the randomly generated candidate collided with another user.
  }

  return NextResponse.json({ error: "Não foi possível reservar um código exclusivo. Tente novamente." }, { status: 503 });
}
