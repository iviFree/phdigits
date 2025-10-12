// lib/supabaseClient.ts
// Cliente de Supabase "lazy": solo se crea cuando lo pides (y en el browser)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Obtiene un cliente de Supabase para el navegador.
 * Lee las envs públicas SOLO cuando se invoca (evita fallar en prerender).
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Mensaje claro si faltan variables (sucede en local o mal configurado en Vercel)
    throw new Error(
      "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
