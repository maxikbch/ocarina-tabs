"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  duplicateEventsWithNewIds,
  getBaseSectionName,
  makeUniqueSectionNameV2,
  normalizeSectionName,
  type SongDocV2,
} from "@/lib/songDocV2";

export default function SectionStrip({
  doc,
  activeInstanceId,
  onActiveInstanceChange,
  onDocChange,
  onRenameSection,
}: {
  doc: SongDocV2;
  activeInstanceId: string | null;
  onActiveInstanceChange: (id: string) => void;
  onDocChange: (next: SongDocV2) => void;
  onRenameSection: (sectionId: string, currentName: string) => void;
}) {
  function patchDoc(mut: (draft: SongDocV2) => void) {
    const next: SongDocV2 = {
      ...doc,
      timing: { ...doc.timing },
      sectionsById: structuredClone(doc.sectionsById),
      arrangement: doc.arrangement.map((x) => ({ ...x })),
    };
    mut(next);
    onDocChange(next);
  }

  function createSection() {
    const sectionId = nanoid();
    const instanceId = nanoid();
    const name = makeUniqueSectionNameV2("General", doc);
    const activeIdx = doc.arrangement.findIndex((i) => i.id === activeInstanceId);
    const insertAt = activeIdx >= 0 ? activeIdx + 1 : doc.arrangement.length;
    patchDoc((d) => {
      d.sectionsById[sectionId] = { id: sectionId, name, events: [] };
      d.arrangement.splice(insertAt, 0, { id: instanceId, sectionId });
    });
    onActiveInstanceChange(instanceId);
  }

  function duplicateSection(fromSectionId: string) {
    const src = doc.sectionsById[fromSectionId];
    if (!src) return;
    const sectionId = nanoid();
    const instanceId = nanoid();
    const name = makeUniqueSectionNameV2(getBaseSectionName(src.name), doc);
    const activeIdx = doc.arrangement.findIndex((i) => i.id === activeInstanceId);
    const insertAt = activeIdx >= 0 ? activeIdx + 1 : doc.arrangement.length;
    patchDoc((d) => {
      d.sectionsById[sectionId] = {
        id: sectionId,
        name,
        events: duplicateEventsWithNewIds(src.events),
      };
      d.arrangement.splice(insertAt, 0, { id: instanceId, sectionId });
    });
    onActiveInstanceChange(instanceId);
  }

  function replicateSection(fromSectionId: string) {
    if (!doc.sectionsById[fromSectionId]) return;
    const instanceId = nanoid();
    const activeIdx = doc.arrangement.findIndex((i) => i.id === activeInstanceId);
    const insertAt = activeIdx >= 0 ? activeIdx + 1 : doc.arrangement.length;
    patchDoc((d) => {
      d.arrangement.splice(insertAt, 0, { id: instanceId, sectionId: fromSectionId });
    });
    onActiveInstanceChange(instanceId);
  }

  const btnStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 10,
    background: "#1f1f1f",
    color: "#eaeaea",
    border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    fontSize: 12,
  };

  const activeSectionId = doc.arrangement.find((i) => i.id === activeInstanceId)?.sectionId ?? null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {doc.arrangement.map((inst, idx) => {
          const sec = doc.sectionsById[inst.sectionId];
          if (!sec) return null;
          const active = inst.id === activeInstanceId;
          return (
            <button
              key={inst.id}
              onClick={() => onActiveInstanceChange(inst.id)}
              onDoubleClick={() => onRenameSection(sec.id, sec.name)}
              style={{
                ...btnStyle,
                border: active ? "2px solid rgba(255,255,255,0.85)" : btnStyle.border,
                background: active ? "#333" : "#1f1f1f",
              }}
              title="Doble clic para renombrar"
            >
              {idx + 1}. {sec.name}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={createSection} style={btnStyle}>
          + Nueva sección
        </button>
        <button
          onClick={() => activeSectionId && duplicateSection(activeSectionId)}
          disabled={!activeSectionId}
          style={{ ...btnStyle, opacity: activeSectionId ? 1 : 0.5 }}
        >
          Duplicar
        </button>
        <button
          onClick={() => activeSectionId && replicateSection(activeSectionId)}
          disabled={!activeSectionId}
          style={{ ...btnStyle, opacity: activeSectionId ? 1 : 0.5 }}
        >
          Replicar
        </button>
      </div>
    </div>
  );
}
