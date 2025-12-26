"use client";

import React from "react";

export default function MiniKeyboard({
  notes,
  onNoteClick,
}: {
  notes: string[];
  onNoteClick: (note: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {notes.map((n) => (
        <button
          key={n}
          onClick={() => onNoteClick(n)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
