"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { codeSchema, normalizeCode, LocalRateLimiter } from "@/lib/validation";
import { getCounterEmail, clearCounterEmail } from "@/lib/session";

const limiter = typeof window !== "undefined" ? new LocalRateLimiter("verify-code", 30, 60_000) : null;

type RpcResp = {
  ok: boolean;
  usuario_id: string | null;
  correo: string | null;
  nombre_completo: string | null;
  consumido_en: string | null; // ISO
}[];

export default function Dashboard() {
  const router = useRouter();
  const [counterEmail, setCounterEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle"|"ok"|"fail"|"error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<{nombre?: string; correo?: string; at?: string} | null>(null);

  useEffect(() => {
    const email = getCounterEmail();
    if (!email) {
      router.replace("/");
    } else {
      setCounterEmail(email);
    }
  }, [router]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setStatus("idle");
    setLastSuccess(null);

    if (!counterEmail) return setMsg("Sesión expirada. Ingresa nuevamente.");

    if (limiter && !limiter.tryConsume()) {
      setMsg("Demasiados intentos. Espera e inténtalo de nuevo.");
      setStatus("fail");
      return;
    }

    const normalized = normalizeCode(code);
    const parsed = codeSchema.safeParse(normalized);
    if (!parsed.success) {
      setStatus("fail");
      setMsg("Código inválido. Debe tener 4 caracteres: 3 dígitos y 1 letra MAYÚSCULA.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_verify_and_consume_code", {
        p_codigo: parsed.data as any, // Supabase char(4) acepta string de 4
        p_counter_email: counterEmail,
      });

      if (error) {
        console.error(error);
        setStatus("error");
        setMsg("Error al verificar el código.");
        return;
      }

      const rows = (data || []) as RpcResp;
      const row = rows[0];
      if (row && row.ok) {
        setStatus("ok");
        setMsg("ACCESO PERMITIDO");
        setLastSuccess({
          nombre: row.nombre_completo ?? undefined,
          correo: row.correo ?? undefined,
          at: row.consumido_en ?? undefined,
        });
        setCode(""); // limpiar input tras éxito
      } else {
        setStatus("fail");
        setMsg("ACCESO DENEGADO (código inexistente o ya consumido).");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMsg("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    clearCounterEmail();
    router.replace("/");
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <h1>Verificación de Invitados</h1>
          {counterEmail && <span className="badge">Counter: {counterEmail}</span>}
        </div>
        <button className="btn outline" onClick={onLogout}>Salir</button>
      </div>

      <form onSubmit={onVerify} autoComplete="off" noValidate>
        <label>
          Código (4 caracteres)
          <input
            className="input"
            type="text"
            inputMode="text"
            pattern="[A-Z0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: A123 o 1A23"
            required
          />
        </label>
        <p className="helper">Formato: 3 dígitos + 1 letra MAYÚSCULA (en cualquier posición).</p>

        <button className="btn" disabled={loading}>
          {loading ? "Verificando..." : "Verificar y Consumir"}
        </button>
      </form>

      {msg && (
        <p className={status === "ok" ? "success" : status === "fail" ? "error" : ""} role="status" aria-live="polite">
          {msg}
        </p>
      )}

      {lastSuccess && (
        <div style={{ marginTop: 12 }}>
          <div className="helper">Consumido:</div>
          <ul>
            {lastSuccess.nombre && <li><strong>Nombre:</strong> {lastSuccess.nombre}</li>}
            {lastSuccess.correo && <li><strong>Correo:</strong> {lastSuccess.correo}</li>}
            {lastSuccess.at && <li><strong>Fecha/Hora:</strong> {new Date(lastSuccess.at).toLocaleString()}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
