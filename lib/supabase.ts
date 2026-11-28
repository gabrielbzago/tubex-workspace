import { createClient } from "@supabase/supabase-js";

// Sessão persistente: fica salva no navegador e o access token é renovado sozinho.
export const supabase =
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
