"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { codeSchema, normalizeCode, LocalRateLimiter } from "@/lib/validation";
import { getCounterEmail, clearCounterEmail } from "@/lib/session";

const limiter =
  typeof window !== "undefined"
    ? new LocalRateLimiter("verify-code", 30, 60_000)
    : null;

type RpcRow = {
  ok: boolean | "t" | "true" | 1 | 0 | "f" | "false";
  usuario_id: string | null;
  correo: string | null;
  nombre_completo: string | null;
  consumido_en: string | null; // ISO
};

type RpcResp = RpcRow[];

export default function Dashboard() {
  const router = useRouter();
  const [counterEmail, setCounterEmail] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "ok" | "fail" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSuccess, setLastSuccess] = useState<{
    nombre?: string;
    correo?: string;
    at?: string;
  } | null>(null);

  // Controla: input deshabilitado + botón "Verificar otro código"
  const [readyForNext, setReadyForNext] = useState<boolean>(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const email = getCounterEmail();
    if (!email) {
      router.replace("/");
    } else {
      setCounterEmail(email);
    }
  }, [router]);

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Limpia mensajes previos y coloca el UI en modo "post-verificación"
    setMsg(null);
    setStatus("idle");
    setLastSuccess(null);

    // 🔑 Desde este punto, cumplimos tu requerimiento:
    // deshabilitar el input y cambiar el botón a "Verificar otro código"
    setReadyForNext(true);

    if (!counterEmail) {
      setMsg("Sesión expirada. Ingresa nuevamente.");
      setStatus("fail");
      return;
    }

    if (limiter && !limiter.tryConsume()) {
      setMsg("Demasiados intentos. Espera e inténtalo de nuevo.");
      setStatus("fail");
      return;
    }

    const normalized = normalizeCode(code);
    const parsed = codeSchema.safeParse(normalized);
    if (!parsed.success) {
      setStatus("fail");
      setMsg(
        "Código inválido."
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      const { data, error } = await supabase.rpc(
        "rpc_verify_and_consume_code",
        {
          p_codigo: parsed.data,
          p_counter_email: counterEmail,
        }
      );

      if (error) {
        console.error(error);
        setStatus("error");
        setMsg("Error al verificar el código.");
        return;
      }

      const rows = (data || []) as RpcResp;
      const row = rows?.[0];
      console.log("RPC row:", row);

      // Normaliza posibles valores de ok
      const okVal = row?.ok as any;
      const isOk =
        okVal === true || okVal === "t" || okVal === "true" || okVal === 1 || okVal === "1";

      if (row && isOk) {
        setStatus("ok");
        setMsg("ACCESO PERMITIDO");
        setLastSuccess({
          nombre: row.nombre_completo ?? undefined,
          correo: row.correo ?? undefined,
          at: row.consumido_en ?? undefined,
        });
      } else {
        setStatus("fail");
        setMsg("ACCESO DENEGADO: CODIGO INVALIDO");
      }

      // Mantener readyForNext=true para que el botón permanezca como "Verificar otro código"
      // y el input siga deshabilitado hasta que el usuario lo reinicie manualmente.
      setCode(""); // opcional: limpia el campo tras el intento
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMsg("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function onResetVerify() {
    // Habilita el input y limpia todo para el siguiente intento
    setReadyForNext(false);
    setCode("");
    setMsg(null);
    setStatus("idle");
    setLastSuccess(null);
    requestAnimationFrame(() => codeInputRef.current?.focus());
  }

  function onLogout() {
    clearCounterEmail();
    router.replace("/");
  }

  return (
    <main className="container-fluid containerMain">
      <div className="row d-flex justify-content-center align-items-center h-100">
        <div className="col-12 col-sm-12 col-md-10 col-lg-7 col-xl-6 col-xxl-6 d-flex justify-content-center flex-column p-5 formContainer">
          <div className="row">
            <div className="col-12 text-center">
              <h1 className="">Verificación de código</h1>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              {counterEmail && <p className="">Counter: {counterEmail}</p>}
            </div>
          </div>

          <form onSubmit={onVerify} className="row">
            <div className="col-12">
              <div className="row mb-2">
                <div className="col-12">
                  <label className="" htmlFor="code">
                    Código de acceso
                  </label>
                </div>
              </div>

              <div className="row mb-2">
                <div className="col-12">
                  <input
                    id="code"
                    ref={codeInputRef}
                    type="text"
                    value={code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCode(e.target.value.toUpperCase())
                    }
                    placeholder=""
                    required
                    className="w-100"
                    disabled={loading || readyForNext} // ← clave
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-6">
                  <button type="button" onClick={onLogout} className="w-100">
                    Salir
                  </button>
                </div>

                <div className="col-6">
                  {!readyForNext ? (
                    <button type="submit" disabled={loading} className="w-100">
                      {loading ? "Verificando..." : "Verificar código"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onResetVerify}
                      className="w-100"
                    >
                      Verificar otro código
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>

          <div className="row mt-4 mb-2">
            <div className="col-12 text-center">
              {msg && (
                <p
                  className={
                    status === "ok"
                      ? "message"
                      : status === "fail"
                      ? "message"
                      : "message"
                  }
                >
                  {msg}
                </p>
              )}
            </div>
          </div>

          <div className="row">
            <div className="col-12 text-center">
              {lastSuccess && (
                <div className="">
                  {lastSuccess.nombre && (
                    <p className="message">Nombre: {lastSuccess.nombre}</p>
                  )}
                  {lastSuccess.correo && (
                    <p className="message">Correo electronico: {lastSuccess.correo}</p>
                  )}
                  {lastSuccess.at && (
                    <p className="message">
                      Fecha y Hora de entrada:{" "}
                      {new Date(lastSuccess.at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* fin de contenedor */}
        </div>
      </div>
    </main>
  );
}
