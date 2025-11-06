"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PostgrestSingleResponse, PostgrestError } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { codeSchema, normalizeCode, LocalRateLimiter } from "@/lib/validation";
import { getCounterEmail, clearCounterEmail } from "@/lib/session";

const limiter =
  typeof window !== "undefined"
    ? new LocalRateLimiter("verify-code", 30, 60_000)
    : null;

type RpcReason = "ok" | "already_used" | "not_found";

type RpcRow = {
  ok: boolean | "t" | "true" | 1 | 0 | "f" | "false";
  reason?: RpcReason | string | null;
  usuario_id: string | null;
  correo: string | null;
  nombre_completo: string | null;
  consumido_en: string | null; // ISO
  invitacion_tipo?: string | null;
};

type RpcResp = RpcRow[];

/** Normaliza el campo `ok` del RPC usando únicamente los literales del tipo. */
function rpcOkToBoolean(v: RpcRow["ok"] | undefined): boolean {
  if (v === true || v === 1 || v === "t" || v === "true") return true;
  if (v === false || v === 0 || v === "f" || v === "false") return false;
  return false;
}

function normalizeInv(raw?: string | null): "sencilla" | "doble" | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v.includes("doble") || v === "2") return "doble";
  if (v.includes("sencilla") || v === "simple" || v === "single" || v === "1") return "sencilla";
  return v as "sencilla" | "doble" | undefined;
}

export default function Dashboard() {
  const router = useRouter();
  const [counterEmail, setCounterEmail] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSuccess, setLastSuccess] = useState<{
    nombre?: string;
    correo?: string;
    at?: string;
    invitacion?: string;
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
      requestAnimationFrame(() => codeInputRef.current?.focus());
    }
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Fuerza MAYÚSCULAS, solo A-Z/0-9, máx 4
    const upper = (e.target.value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    setCode(upper);
  }

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg(null);
    setLastSuccess(null);

    // Deshabilita el input y cambia el botón
    setReadyForNext(true);

    if (!counterEmail) {
      setMsg("Sesión expirada. Ingresa nuevamente.");
      return;
    }

    if (limiter && !limiter.tryConsume()) {
      setMsg("Demasiados intentos. Espera e inténtalo de nuevo.");
      return;
    }

    const normalized = normalizeCode(code);
    const parsed = codeSchema.safeParse(normalized);
    if (!parsed.success) {
      setMsg("Código inválido.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      // Llamada a la RPC V3 que retorna invitacion_tipo y reason
      const resp = (await supabase.rpc(
        "rpc_verify_and_consume_code_v3",
        {
          p_codigo: parsed.data,
          p_counter_email: counterEmail,
        }
      )) as PostgrestSingleResponse<RpcResp>;

      const { data, error } = resp;

      if (error) {
        handleRpcError(error);
        return;
      }

      const rows: RpcResp = Array.isArray(data) ? data : [];
      const row: RpcRow | undefined = rows[0];
      console.log("RPC v3 row:", row);

      const isOk = rpcOkToBoolean(row?.ok);
      const reason = (row?.reason ?? "").toString() as RpcReason | string;
      const invitacionTipo = normalizeInv(row?.invitacion_tipo ?? undefined) ?? undefined;

      if (row && isOk) {
        const etiquetaInv = invitacionTipo
          ? ` — Invitación: ${invitacionTipo.toUpperCase()}`
          : " — Invitación: NO DISPONIBLE";
        setMsg(`ACCESO PERMITIDO${etiquetaInv}`);
        setLastSuccess({
          nombre: row.nombre_completo ?? undefined,
          correo: row.correo ?? undefined,
          at: row.consumido_en ?? undefined,
          invitacion: invitacionTipo ?? undefined,
        });
      } else if (row && reason === "already_used") {
        const etiquetaInv = invitacionTipo ? ` — Invitación: ${invitacionTipo.toUpperCase()}` : "";
        setMsg(`ACCESO DENEGADO: CÓDIGO YA UTILIZADO${etiquetaInv}`);
        setLastSuccess({
          nombre: row.nombre_completo ?? undefined,
          correo: row.correo ?? undefined,
          at: row.consumido_en ?? undefined,
          invitacion: invitacionTipo ?? undefined,
        });
      } else if (row && reason === "not_found") {
        setMsg("ACCESO DENEGADO: CÓDIGO INEXISTENTE");
      } else {
        setMsg("ACCESO DENEGADO: CODIGO INVALIDO");
      }

      // Mantener readyForNext=true para mostrar "Verificar otro código"
      setCode(""); // limpia el campo tras el intento
    } catch (err) {
      console.error(err);
      setMsg("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function handleRpcError(error: PostgrestError) {
    console.error("RPC error:", error);
    if (error.code === "42883") {
      setMsg(
        "RPC no existe o falta pgcrypto/citext. Revisa la creación de funciones."
      );
    } else if (error.code === "PGRST116" || error.message?.includes("404")) {
      setMsg("RPC no encontrada o sin permisos (GRANT EXECUTE).");
    } else {
      setMsg("Error al verificar el código.");
    }
  }

  function onResetVerify(): void {
    setReadyForNext(false);
    setCode("");
    setMsg(null);
    setLastSuccess(null);
    requestAnimationFrame(() => codeInputRef.current?.focus());
  }

  function onLogout(): void {
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
                    inputMode="text"
                    value={code}
                    onChange={handleChange}
                    placeholder=""
                    required
                    className="w-100"
                    disabled={loading || readyForNext}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4}
                    style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
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
                    <button type="submit" disabled={loading || code.length !== 4} className="w-100">
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
              {msg && <p className="message">{msg}</p>}
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
                    <p className="message">
                      Correo electrónico: {lastSuccess.correo}
                    </p>
                  )}
                  {lastSuccess.at && (
                    <p className="message">
                      Fecha y hora de entrada:{" "}
                      {new Date(lastSuccess.at).toLocaleString()}
                    </p>
                  )}
                  {lastSuccess.invitacion && (
                    <p className="message">
                      Invitación: {lastSuccess.invitacion.toUpperCase()}
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
