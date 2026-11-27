import { supabaseAdmin } from "@/lib/supabase-admin";

export type AuthUserLite = { id: string; email: string | null; name: string | null; avatar: string | null; created_at: string | null };

/**
 * Contas do Supabase Auth (cadastro/login no site). Muitas contas não têm linha em
 * public.users (só quem assinou ou foi sincronizado), então o painel mostrava
 * "Sem nome" e só o UUID. Aqui lemos o Auth paginado (até 20 mil contas).
 */
export async function listAuthUsers(maxPages = 20): Promise<AuthUserLite[]> {
  const out: AuthUserLite[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.warn("[TubeX auth users]", error.message); break; }
    const users = data?.users || [];
    for (const u of users) {
      const meta: any = u.user_metadata || {};
      out.push({
        id: u.id,
        email: u.email ? u.email.toLowerCase() : null,
        name: meta.full_name || meta.name || meta.display_name || null,
        avatar: meta.avatar_url || meta.picture || null,
        created_at: u.created_at || null,
      });
    }
    if (users.length < 1000) break;
  }
  return out;
}
