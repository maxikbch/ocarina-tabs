"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { iconProps } from "@/components/icons";

export default function LoadingModal({
  open,
  title = "Procesando…",
  message,
  zIndex = 1140,
}: {
  open: boolean;
  title?: string;
  message?: string;
  zIndex?: number;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "min(92vw, 360px)",
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {message ? <div style={{ opacity: 0.9 }}>{message}</div> : null}
        <Loader2
          {...iconProps(28)}
          aria-label="Cargando"
          style={{ margin: "0 auto", animation: "spin 0.9s linear infinite" }}
        />
        <style>
          {`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}
        </style>
      </div>
    </div>
  );
}


