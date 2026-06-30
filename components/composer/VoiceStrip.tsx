"use client";

import React, { useState } from "react";
import type { SongDocV2, VoiceDef } from "@/lib/songDocV2";
import { patchSongDocV2 } from "@/lib/songDocV2";
import { hasVoiceLayers } from "@/lib/songVoices";

export default function VoiceStrip({
  doc,
  activeVoiceId,
  onActiveVoiceIdChange,
  onDocChange,
  onRequestConsolidate,
}: {
  doc: SongDocV2;
  activeVoiceId: string | undefined;
  onActiveVoiceIdChange: (id: string) => void;
  onDocChange: (next: SongDocV2) => void;
  onRequestConsolidate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!hasVoiceLayers(doc) || !doc.voices) return null;

  const voices = doc.voices;

  function patchVoice(voiceId: string, patch: Partial<VoiceDef>) {
    onDocChange(
      patchSongDocV2(doc, (d) => {
        if (!d.voices?.[voiceId]) return;
        d.voices = { ...d.voices, [voiceId]: { ...d.voices[voiceId], ...patch } };
      })
    );
  }

  function startRename(voiceId: string, currentName: string) {
    setEditingId(voiceId);
    setEditName(currentName);
  }

  function commitRename(voiceId: string) {
    const trimmed = editName.trim();
    if (trimmed) patchVoice(voiceId, { name: trimmed });
    setEditingId(null);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(20, 20, 20, 0.6)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Voces</span>
        <button
          onClick={onRequestConsolidate}
          title="Fusionar voces visibles en un arreglo monofónico"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255, 160, 80, 0.35)",
            background: "rgba(80, 50, 30, 0.45)",
            color: "#ffe8d0",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Consolidar voces
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(voices).map(([id, voice]) => {
          const isActive = activeVoiceId === id;
          return (
            <div
              key={id}
              onClick={() => onActiveVoiceIdChange(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 8,
                cursor: "pointer",
                border: isActive
                  ? "1px solid rgba(255,255,255,0.35)"
                  : "1px solid transparent",
                background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                opacity: voice.hidden ? 0.55 : 1,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: voice.color,
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              />
              {editingId === id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "#1a1a1a",
                    color: "#eaeaea",
                    fontSize: 12,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(id, voice.name);
                  }}
                  style={{ flex: 1, fontSize: 12, fontWeight: isActive ? 800 : 500 }}
                  title="Doble clic para renombrar"
                >
                  {voice.name}
                  {isActive ? " · activa" : ""}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  patchVoice(id, { hidden: !voice.hidden });
                }}
                title={voice.hidden ? "Mostrar voz" : "Ocultar voz"}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "#1f1f1f",
                  color: "#eaeaea",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {voice.hidden ? "Mostrar" : "Ocultar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
