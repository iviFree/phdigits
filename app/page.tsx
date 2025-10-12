// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { emailSchema, passwordSchema, LocalRateLimiter } from "@/lib/validation";
import { setCounterEmail, getCounterEmail } from "@/lib/session";

// Rate limit local: 10 intentos por minuto en el login
const limiter =
  typeof window !== "undefined" ? new LocalRateLimiter("counter-login", 10, 60_000) : null;

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Si ya hay sesión, redirige al dashboard
    const existing = getCounterEmail();
    if (existing) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (limiter && !limiter.tryConsume()) {
      setMsg("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
      return;
    }

    // Validaciones fuertes de entrada
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
      // Llamada RPC a Supabase
      const { data, error } = await supabase.rpc("rpc_counter_validate", {
        p_mail: parsedEmail.data,
        p_password: parsedPass.data,
      });

      if (error) {
        // Diferencia casos comunes para diagnóstico claro
        const anyErr = error as any;
        if (anyErr.code === "42883") {
          setMsg("Backend sin pgcrypto/citext o RPC mal creada (crypt() no disponible). Avise a soporte.");
        } else if (anyErr.code === "PGRST116" || (anyErr.message && String(anyErr.message).includes("404"))) {
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
    <div className="card">
      <h1>Ingreso de Counter</h1>
      <p className="helper">Introduce tu correo y contraseña.</p>

      <form onSubmit={onSubmit} autoComplete="off" noValidate>
        <label>
          Correo
          <input
            className="input"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </label>

        <label>
          Contraseña
          <input
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            minLength={8}
            maxLength={128}
          />
        </label>

        <button className="btn" disabled={loading}>
          {loading ? "Validando..." : "Entrar"}
        </button>
      </form>

      {msg && (
        <p className="error" role="alert" aria-live="assertive">
          {msg}
        </p>
      )}

      <p className="helper">
        Tu contraseña se valida contra el hash almacenado en la base de datos mediante RPC segura
        (no se guarda en el navegador).
      </p>
    </div>
  );
}
