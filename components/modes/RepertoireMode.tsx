"use client";

import React from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { IconLabel } from "@/components/icons";

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
        style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center" }}
        title="Descargar compendio como JSON"
      >
        <IconLabel icon={Download}>Descargar compendio</IconLabel>
      </button>
      <button
        onClick={onUploadClick}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center" }}
        title="Cargar compendio desde JSON"
      >
        <IconLabel icon={Upload}>Cargar compendio</IconLabel>
      </button>
      <button
        onClick={onClear}
        style={{ padding: "10px 12px", borderRadius: 12, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center" }}
        title="Borrar todas las canciones guardadas"
      >
        <IconLabel icon={Trash2}>Borrar compendio</IconLabel>
      </button>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onUploadChange} />
    </div>
  );
}

