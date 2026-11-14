import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params;
  const code = String(rawCode || "").trim().toUpperCase();
  const fallback = process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://www.tubexai.com.br";
  const destination = new URL("/", fallback);
  destination.searchParams.set("ref", code);

  if (!/^[A-Z0-9_-]{4,40}$/.test(code)) return NextResponse.redirect(new URL("/", fallback), 302);

  const { data: affiliate, error } = await supabaseAdmin
    .from("users").select("id").eq("affiliate_code", code).maybeSingle();
  if (error || !affiliate) return NextResponse.redirect(new URL("/", fallback), 302);

  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "";
  const ip = headers.get("x-real-ip") || forwarded || "unknown";
  const userAgent = headers.get("user-agent") || "unknown";
  const clickDate = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256")
    .update(`${ip}|${userAgent}|${clickDate}|${process.env.AFFILIATE_CLICK_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "tubex-click-v1"}`)
    .digest("hex");

  let safeReferrer: string | null = null;
  try {
    const referrer = headers.get("referer");
    if (referrer) { const parsed = new URL(referrer); safeReferrer = `${parsed.origin}${parsed.pathname}`.slice(0, 500); }
  } catch { safeReferrer = null; }

  const { error: clickError } = await supabaseAdmin.from("affiliate_clicks").upsert({
    affiliate_code: code,
    visitor_hash: visitorHash,
    click_date: clickDate,
    landing_path: "/",
    referrer: safeReferrer,
  }, { onConflict: "affiliate_code,visitor_hash,click_date", ignoreDuplicates: true });

  if (clickError) console.warn("Affiliate click was not recorded:", clickError.message);

  return NextResponse.redirect(destination, 302);
}
