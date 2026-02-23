"use client";

import React from "react";

export default function RepertoireMode({
  fileRef,
  onDownload,
  onUploadClick,
  onClear,
  onUploadChange,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDownload: () => void;
  onUploadClick: () => void;
  onClear: () => void | Promise<void>;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
      <button
        onClick={onDownload}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Descargar repertorio como JSON"
      >
        Descargar repertorio
      </button>
      <button
        onClick={onUploadClick}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Cargar repertorio desde JSON"
      >
        Cargar repertorio
      </button>
      <button
        onClick={onClear}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Borrar todas las canciones guardadas"
      >
        Borrar repertorio
      </button>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onUploadChange} />
    </div>
  );
}

