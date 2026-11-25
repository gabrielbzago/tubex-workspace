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
