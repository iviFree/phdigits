"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import {
  emailSchema,
  passwordSchema,
  LocalRateLimiter,
} from "@/lib/validation";
import { setCounterEmail, getCounterEmail } from "@/lib/session";

const limiter =
  typeof window !== "undefined"
    ? new LocalRateLimiter("counter-login", 10, 60_000)
    : null;

type PgError = { code?: string; message?: string };

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [pass, setPass] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const existing = getCounterEmail();
    if (existing) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    if (limiter && !limiter.tryConsume()) {
      setMsg("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
      return;
    }

    const parsedEmail = emailSchema.safeParse(email);
    const parsedPass = passwordSchema.safeParse(pass);

    if (!parsedEmail.success) {
      setMsg("Correo inválido.");
      return;
    }
    if (!parsedPass.success) {
      setMsg("Contraseña inválida (mínimo 8 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      const { data, error } = await supabase.rpc("rpc_counter_validate", {
        p_mail: parsedEmail.data,
        p_password: parsedPass.data,
      });

      if (error) {
        const pgErr = error as PgError;
        if (pgErr.code === "42883") {
          setMsg(
            "Backend sin pgcrypto/citext o RPC mal creada (crypt() no disponible)."
          );
        } else if (
          pgErr.code === "PGRST116" ||
          (pgErr.message && String(pgErr.message).includes("404"))
        ) {
          setMsg("RPC no encontrada o sin permisos (GRANT EXECUTE).");
        } else {
          setMsg("Error al validar credenciales.");
        }
        console.error(error);
        return;
      }

      if (data === true) {
        setCounterEmail(parsedEmail.data);
        router.push("/dashboard");
      } else {
        setMsg("Credenciales incorrectas.");
      }
    } catch (err) {
      console.error(err);
      setMsg("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h2 className="text-2xl font-semibold mb-2">Ingreso de Counter</h2>
      <p className="text-sm text-gray-600 mb-6">
        Introduce tu correo y contraseña.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            required
            maxLength={254}
            placeholder="counter@ejemplo.com"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="pass">
            Contraseña
          </label>
          <input
            id="pass"
            type="password"
            value={pass}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPass(e.target.value)
            }
            required
            minLength={8}
            maxLength={128}
            placeholder="••••••••"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black text-white py-2"
        >
          {loading ? "Validando..." : "Entrar"}
        </button>

        {msg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {msg}
          </p>
        )}
      </form>

      <p className="text-xs text-gray-500 mt-6">
        Tu contraseña se valida contra el hash en la base de datos mediante RPC
        segura.
      </p>
    </main>
  );
}
