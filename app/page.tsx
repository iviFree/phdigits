"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { emailSchema, passwordSchema, LocalRateLimiter } from "@/lib/validation";
import { setCounterEmail, getCounterEmail } from "@/lib/session";

const limiter =
  typeof window !== "undefined" ? new LocalRateLimiter("counter-login", 10, 60_000) : null;

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
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
      const { data, error } = await supabase.rpc("rpc_counter_validate", {
        p_mail: parsedEmail.data,
        p_password: parsedPass.data,
      });

      if (error) {
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
    <div className="card shadow-sm mx-auto" style={{ maxWidth: "420px" }}>
      <div className="card-body">
        <h2 className="card-title text-center mb-4">Ingreso de Counter</h2>

        <p className="text-muted text-center">
          Introduce tu correo y contraseña.
        </p>

        <form onSubmit={onSubmit} autoComplete="off" noValidate>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="email"
              className="form-control"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              placeholder="counter@ejemplo.com"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <input
              id="password"
              className="form-control"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-dark w-100"
            disabled={loading}
          >
            {loading ? "Validando..." : "Entrar"}
          </button>
        </form>

        {msg && (
          <div
            className={`alert mt-3 ${
              msg.includes("ACCESO") || msg.includes("correctas")
                ? "alert-success"
                : "alert-danger"
            }`}
            role="alert"
          >
            {msg}
          </div>
        )}

        <p className="text-muted small mt-3 mb-0 text-center">
          Tu contraseña se valida contra el hash en la base de datos mediante RPC segura.
        </p>
      </div>
    </div>
  );
}
