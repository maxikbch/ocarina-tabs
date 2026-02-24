"use client";

import React from "react";

export default function RepertoireMode({
  fileRef,
  onDownload,
  onUploadClick,
  onClear,
  onUploadChange,
}: {
  fileRef: React.RefObject<HTMLInputElement>;
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
        title="Descargar compendio como JSON"
      >
        Descargar compendio
      </button>
      <button
        onClick={onUploadClick}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Cargar compendio desde JSON"
      >
        Cargar compendio
      </button>
      <button
        onClick={onClear}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Borrar todas las canciones guardadas"
      >
        Borrar compendio
      </button>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onUploadChange} />
    </div>
  );
}

