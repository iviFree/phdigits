// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// NOTA: solo usamos RPCs permitidos por RLS. No almacenamos tokens propios aquí.
export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
