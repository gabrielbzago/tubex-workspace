import { supabaseAdmin } from "@/lib/supabase-admin";

const split = (value?: string) => String(value || "").split(",").map(v => v.trim()).filter(Boolean);
const OWNER_EMAILS = new Set([
  "gabrielbzago@gmail.com",
  ...split(process.env.OWNER_EMAILS),
  ...split(process.env.NEXT_PUBLIC_OWNER_EMAILS),
  process.env.NEXT_PUBLIC_OWNER_EMAIL || "",
].map(v => v.trim().toLowerCase()).filter(Boolean));
const OWNER_USER_IDS = new Set([
  ...split(process.env.OWNER_USER_IDS),
  ...split(process.env.NEXT_PUBLIC_OWNER_USER_IDS),
]);

const OWNER_ROLES = new Set(["owner", "admin", "administrator"]);

function rowIsOwner(row: any) {
  if (!row) return false;
  const roles = [row.role, row.user_role, row.account_role, row.plan]
    .map(v => String(v || "").trim().toLowerCase());
  return roles.some(v => OWNER_ROLES.has(v)) || row.is_owner === true || row.is_admin === true;
}

/**
 * Autoriza pelo usuário autenticado do Supabase, nunca pelo canal do YouTube
 * selecionado no workspace. Os canais são contexto de análise, não identidade.
 */
export async function isTubeXOwner(user: any): Promise<boolean> {
  if (!user?.id) return false;
  if (await isOwnerIdentity(user)) return true;
  return ownsChannelOfOwner(user.id);
}

/**
 * Caso a pessoa entre no TubeX escolhendo direto um canal de marca no login Google, o Supabase pode
 * criar outra conta (com um e-mail técnico da conta de marca). Ela continua owner quando:
 * - o consentimento Google desse canal veio de um e-mail owner (verificado no tokeninfo do Google), ou
 * - o mesmo canal também está conectado à conta TubeX do owner.
 * Ou seja, o owner continua ligado ao usuário/e-mail do owner; o canal só faz a ponte entre contas.
 */
async function ownsChannelOfOwner(userId: string): Promise<boolean> {
  try {
    const { data: mine } = await supabaseAdmin.from("tubex_google_channels").select("channel_id,google_email").eq("user_id", userId).limit(50);
    const rows = mine || [];
    if (rows.some((r: any) => OWNER_EMAILS.has(String(r.google_email || "").trim().toLowerCase()))) return true;
    const ids = rows.map((r: any) => String(r.channel_id)).filter(Boolean);
    if (!ids.length) return false;
    const { data: others } = await supabaseAdmin.from("tubex_google_channels").select("user_id").in("channel_id", ids).neq("user_id", userId).limit(20);
    for (const uid of new Set((others || []).map((r: any) => String(r.user_id)))) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (data?.user && await isOwnerIdentity(data.user)) return true;
    }
  } catch {}
  return false;
}

async function isOwnerIdentity(user: any): Promise<boolean> {
  if (!user?.id) return false;
  if (OWNER_USER_IDS.has(String(user.id))) return true;

  const appRole = String(user.app_metadata?.role || user.app_metadata?.user_role || "").toLowerCase();
  if (OWNER_ROLES.has(appRole)) return true;

  const emails = new Set<string>();
  if (user.email) emails.add(String(user.email).trim().toLowerCase());
  for (const identity of user.identities || []) {
    const email = identity?.identity_data?.email || identity?.email;
    if (email) emails.add(String(email).trim().toLowerCase());
  }
  if ([...emails].some(email => OWNER_EMAILS.has(email))) return true;

  try {
    const byId = await supabaseAdmin.from("users").select("*").eq("id", user.id).maybeSingle();
    if (rowIsOwner(byId.data)) return true;
  } catch {}

  for (const email of emails) {
    try {
      const byEmail = await supabaseAdmin.from("users").select("*").ilike("email", email.replace(/[\\%_]/g, ch => `\\${ch}`)).limit(10);
      if ((byEmail.data || []).some(rowIsOwner)) return true;
    } catch {}
  }
  return false;
}
