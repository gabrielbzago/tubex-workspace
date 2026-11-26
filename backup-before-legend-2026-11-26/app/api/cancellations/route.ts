import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedUser } from "@/lib/tubex-backend";
import { isTubeXOwner } from "@/lib/tubex-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const ALLOWED_REASONS = new Set([
  "Não estou utilizando o TubeX",
  "O preço está alto",
  "Não estou conseguindo os resultados esperados",
  "Faltam funcionalidades que preciso",
  "Estou enfrentando problemas técnicos",
  "Encontrei outra ferramenta",
  "Estou deixando o YouTube",
  "Outro motivo",
]);

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada.");
  return new Stripe(key);
}


function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) {
    console.warn("[TubeX cancellations] E-mail não enviado: configure RESEND_API_KEY, RESEND_FROM_EMAIL e destinatário.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[TubeX cancellations] Resend falhou:", response.status, detail.slice(0, 500));
    return false;
  }
  return true;
}

async function notifyEmails(request: any) {
  const ownerEmail =
    process.env.CANCELLATION_NOTIFICATION_EMAIL ||
    process.env.NEXT_PUBLIC_OWNER_EMAIL ||
    "gabrielbzago@gmail.com";

  const periodEnd = request.period_end
    ? new Date(request.period_end).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    : "data ainda não disponível";

  const details = `
    <h2>Solicitação de cancelamento recebida — TubeX</h2>
    <p><b>Nome:</b> ${escapeHtml(request.account_name || "Não informado")}</p>
    <p><b>E-mail:</b> ${escapeHtml(request.account_email)}</p>
    <p><b>Plano:</b> ${escapeHtml(String(request.plan || "—").toUpperCase())}</p>
    <p><b>Motivo:</b> ${escapeHtml(request.reason)}</p>
    <p><b>Comentário:</b> ${escapeHtml(request.feedback || "Não informado")}</p>
    <p><b>Melhoria sugerida:</b> ${escapeHtml(request.improvement || "Não informado")}</p>
    <p><b>Voltaria ao TubeX:</b> ${escapeHtml(request.would_return || "Não informado")}</p>
    <p><b>Assinatura Stripe:</b> ${escapeHtml(request.stripe_subscription_id)}</p>
    <p><b>Acesso até:</b> ${escapeHtml(periodEnd)}</p>
    <p><b>Status:</b> Cancelamento agendado — acesso mantido até o fim do período pago.</p>
    <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "https://tubex.app.br")}/dashboard">Abrir painel TubeX</a></p>
  `;

  const userHtml = `
    <h2>Recebemos sua solicitação de cancelamento</h2>
    <p>Olá${request.account_name ? `, ${escapeHtml(request.account_name)}` : ""}!</p>
    <p>Sua solicitação foi registrada e a renovação automática da sua assinatura TubeX foi desativada.</p>
    <p><b>Você continuará tendo acesso ao seu plano ${escapeHtml(String(request.plan || "").toUpperCase())} até ${escapeHtml(periodEnd)}.</b></p>
    <p>Após essa data, o acesso aos recursos pagos será encerrado. Você não precisará realizar nenhuma outra ação.</p>
    <p>Obrigado por ter utilizado o TubeX. Sua opinião nos ajuda a melhorar.</p>
    <p>Equipe TubeX</p>
  `;

  const [ownerSent, userSent] = await Promise.all([
    sendEmail(ownerEmail, `TubeX — cancelamento solicitado: ${request.account_email}`, details),
    sendEmail(request.account_email, "TubeX — sua solicitação de cancelamento foi registrada", userHtml),
  ]);
  return { ownerSent, userSent };
}

async function findUserRow(user: { id: string; email?: string | null }) {
  const columns = "id,email,name,plan,status,stripe_customer_id,stripe_subscription_id";
  const byId = await supabaseAdmin.from("users").select(columns).eq("id", user.id).maybeSingle();
  if (byId.error) throw byId.error;
  if (byId.data) return byId.data;

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;
  const byEmail = await supabaseAdmin.from("users").select(columns).eq("email", email).limit(1).maybeSingle();
  if (byEmail.error) throw byEmail.error;
  return byEmail.data;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });

    if (await isTubeXOwner(user)) {
      const { data, error } = await supabaseAdmin
        .from("cancellation_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return NextResponse.json({ success: true, requests: data || [], is_owner: true });
    }

    const { data, error } = await supabaseAdmin
      .from("cancellation_requests")
      .select("id,plan,reason,feedback,improvement,would_return,status,created_at,period_end,completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return NextResponse.json({ success: true, requests: data || [], is_owner: false });
  } catch (error: any) {
    console.error("[TubeX cancellations] GET:", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico de cancelamentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let insertedId: string | null = null;
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser?.id || !authUser.email) {
      return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim();
    const feedback = String(body?.feedback || "").trim().slice(0, 3000);
    const improvement = String(body?.improvement || "").trim().slice(0, 3000);
    const wouldReturn = String(body?.would_return || "").trim();

    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: "Selecione o motivo principal do cancelamento." }, { status: 400 });
    }
    if (wouldReturn && !["Sim", "Talvez", "Não"].includes(wouldReturn)) {
      return NextResponse.json({ error: "Resposta inválida para a pergunta sobre retorno." }, { status: 400 });
    }

    const account = await findUserRow(authUser);
    if (!account) {
      return NextResponse.json({ error: "Não encontramos sua assinatura TubeX. Entre em contato com o suporte." }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("cancellation_requests")
      .select("*")
      .eq("user_id", authUser.id)
      .in("status", ["processing", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({
        success: true,
        already_requested: true,
        request: existing,
        message: "Já existe uma solicitação de cancelamento em andamento.",
      });
    }

    let subscriptionId = String(account.stripe_subscription_id || "").trim();
    const stripe = getStripe();
    let subscription: Stripe.Subscription | null = null;

    if (subscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (retrieveError) {
        console.warn("[TubeX cancellations] subscription_id salvo não foi encontrado; tentando localizar pelo customer.", retrieveError);
      }
    }

    // Se o ID salvo estiver antigo/encerrado, tenta localizar a assinatura paga
    // atual do mesmo customer para não bloquear clientes que já reativaram o plano.
    const subscriptionIsClosed = !subscription || ["canceled", "incomplete_expired"].includes(subscription.status);
    if (subscriptionIsClosed && account.stripe_customer_id) {
      const listed = await stripe.subscriptions.list({
        customer: String(account.stripe_customer_id),
        status: "all",
        limit: 100,
      });
      const candidates = listed.data
        .filter((item) => ["active", "trialing", "past_due"].includes(item.status))
        .sort((a, b) => Number((b as any).current_period_end || 0) - Number((a as any).current_period_end || 0));
      subscription = candidates[0] || subscription;
      subscriptionId = subscription && !["canceled", "incomplete_expired"].includes(subscription.status)
        ? subscription.id
        : "";
    }

    if (!subscription || !subscriptionId) {
      return NextResponse.json({ error: "Não encontramos uma assinatura Stripe ativa vinculada à sua conta. Fale com o suporte para concluir o cancelamento." }, { status: 409 });
    }
    if (["canceled", "incomplete_expired"].includes(subscription.status)) {
      return NextResponse.json({ error: "Esta assinatura já está encerrada." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const periodEndSeconds = Number((subscription as any).current_period_end || (subscription as any).cancel_at || 0);
    const periodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null;

    const { data: created, error: insertError } = await supabaseAdmin
      .from("cancellation_requests")
      .insert({
        user_id: authUser.id,
        account_email: String(authUser.email).trim().toLowerCase(),
        account_name: account.name || authUser.user_metadata?.full_name || null,
        plan: String(account.plan || "free").toLowerCase(),
        stripe_customer_id: account.stripe_customer_id || String(subscription.customer || ""),
        stripe_subscription_id: subscriptionId,
        reason,
        feedback: feedback || null,
        improvement: improvement || null,
        would_return: wouldReturn || null,
        status: "processing",
        period_end: periodEnd,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: duplicate } = await supabaseAdmin.from("cancellation_requests")
          .select("*").eq("user_id", authUser.id).in("status", ["processing", "scheduled"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (duplicate) return NextResponse.json({ success: true, already_requested: true, request: duplicate });
      }
      throw insertError;
    }
    insertedId = created.id;

    try {
      if (!subscription.cancel_at_period_end) {
        subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      }
    } catch (stripeError) {
      await supabaseAdmin.from("cancellation_requests")
        .update({ status: "failed", failure_reason: String((stripeError as any)?.message || "stripe_update_failed").slice(0, 500), updated_at: new Date().toISOString() })
        .eq("id", insertedId);
      throw stripeError;
    }

    const finalPeriodEndSeconds = Number((subscription as any).current_period_end || (subscription as any).cancel_at || periodEndSeconds);
    const finalPeriodEnd = finalPeriodEndSeconds ? new Date(finalPeriodEndSeconds * 1000).toISOString() : periodEnd;

    const { data: scheduled, error: updateError } = await supabaseAdmin
      .from("cancellation_requests")
      .update({
        status: "scheduled",
        period_end: finalPeriodEnd,
        stripe_cancel_scheduled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insertedId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    const emailResults = await notifyEmails(scheduled);
    await supabaseAdmin.from("cancellation_requests").update({
      owner_email_sent: emailResults.ownerSent,
      user_email_sent: emailResults.userSent,
      updated_at: new Date().toISOString(),
    }).eq("id", insertedId);

    return NextResponse.json({
      success: true,
      request: scheduled,
      email_notifications: emailResults,
      message: "Cancelamento agendado. Seu acesso continuará até o fim do período já pago.",
    });
  } catch (error: any) {
    console.error("[TubeX cancellations] POST:", error);
    return NextResponse.json({
      error: error?.message || "Não foi possível registrar sua solicitação. Tente novamente ou fale com o suporte.",
      request_id: insertedId,
    }, { status: 500 });
  }
}
