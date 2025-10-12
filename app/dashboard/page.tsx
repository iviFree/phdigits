"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { codeSchema, normalizeCode, LocalRateLimiter } from "@/lib/validation";
import { getCounterEmail, clearCounterEmail } from "@/lib/session";

const limiter =
  typeof window !== "undefined"
    ? new LocalRateLimiter("verify-code", 30, 60_000)
    : null;

type RpcRow = {
  ok: boolean;
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
  const [status, setStatus] = useState<"idle" | "ok" | "fail" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSuccess, setLastSuccess] = useState<{
    nombre?: string;
    correo?: string;
    at?: string;
  } | null>(null);

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
    setMsg(null);
    setStatus("idle");
    setLastSuccess(null);

    if (!counterEmail) {
      setMsg("Sesión expirada. Ingresa nuevamente.");
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
        "Código inválido. Debe tener 4 caracteres: 3 dígitos y 1 letra MAYÚSCULA."
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
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Verificación de Invitados</h1>
        <button
          type="button"
          onClick={onLogout}
          className="rounded bg-gray-200 px-3 py-1"
        >
          Salir
        </button>
      </div>

      {counterEmail && (
        <p className="text-sm text-gray-600">Counter: {counterEmail}</p>
      )}

      <form onSubmit={onVerify} className="space-y-3">
        <label className="block text-sm" htmlFor="code">
          Código (4 caracteres)
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCode(e.target.value)
          }
          placeholder="Ej: A123 o 1A23"
          required
          className="w-full rounded border px-3 py-2"
        />

        <p className="text-xs text-gray-500">
          Formato: 3 dígitos + 1 letra MAYÚSCULA (en cualquier posición).
        </p>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2"
        >
          {loading ? "Verificando..." : "Verificar y Consumir"}
        </button>
      </form>

      {msg && (
        <p
          className={
            status === "ok"
              ? "text-green-700 bg-green-50 border border-green-200 rounded p-2"
              : status === "fail"
              ? "text-red-700 bg-red-50 border border-red-200 rounded p-2"
              : "text-amber-700 bg-amber-50 border border-amber-200 rounded p-2"
          }
        >
          {msg}
        </p>
      )}

      {lastSuccess && (
        <div className="rounded border p-3">
          <p className="font-medium mb-2">Consumido:</p>
          {lastSuccess.nombre && <p>• Nombre: {lastSuccess.nombre}</p>}
          {lastSuccess.correo && <p>• Correo: {lastSuccess.correo}</p>}
          {lastSuccess.at && (
            <p>• Fecha/Hora: {new Date(lastSuccess.at).toLocaleString()}</p>
          )}
        </div>
      )}
    </main>
  );
}
