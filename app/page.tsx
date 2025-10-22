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
import Image from "next/image";

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
    <main className="container-fluid containerMain">
      <div className="row d-flex justify-content-center align-items-center h-100">
        <div className="col-12 col-sm-12 col-md-10 col-lg-7 col-xl-6 col-xxl-6 d-flex justify-content-center flex-column p-5 formContainer">
          <div className="row m-3 mb-5">
            <div className="col-12 text-center">
              <div className="logo-container text-center">
                <Image
                  src="/logoPalaciodeHierro.png"
                  alt="Logo Palacio de Hierro"
                  className="logo-palacio img-fluid"
                  width={0}
                  height={0}
                  sizes="100vw"
                  priority
                />
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12 text-center">
              <p>Introduce tu correo y contraseña.</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="row">
            <div className="col-12">
              <div className="row mb-1">
                <div className="col-12">
                  <label htmlFor="email">Correo</label>
                </div>
              </div>
              <div className="row mb-1">
                <div className="col-12">
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
                    className="w-100"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <div className="row mb-1">
                <div className="col-12">
                  <label htmlFor="pass">Contraseña</label>
                </div>
              </div>
              <div className="row mb-4">
                <div className="col-12">
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
                    className="w-100"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-12">
                  <button type="submit" disabled={loading} className="buttonLogin">
                    {loading ? "Validando..." : "Entrar"}
                  </button>
                  {msg && <p className="">{msg}</p>}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
