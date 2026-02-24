"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import SongTimeline from "@/components/SongTimeline";
import type { NoteLabelMode } from "@/lib/noteLabels";
import type { NoteEvent } from "@/lib/types";

type PlaySection = {
  instanceId: string;
  name: string;
  events: NoteEvent[];
};

export default function PlayMode({
  selectedSaved,
  savedNamesCount,
  onOpenPicker,
  sections,
  selectedId,
  onSelectEvent,
  onRemoveEvent,
  onReorderEvent,
  noteLabelMode,
}: {
  selectedSaved: string;
  savedNamesCount: number;
  onOpenPicker: () => void;
  sections: PlaySection[];
  selectedId: string | null;
  onSelectEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onReorderEvent: (sourceId: string, targetIndex: number) => void;
  noteLabelMode: NoteLabelMode;
}) {
  const [selectedSectionInstanceId, setSelectedSectionInstanceId] = useState<string | null>(null);
  const sectionElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  // Flag para futuro panel de opciones
  const animateSectionScroll = false;
  const lastSongRef = useRef<string>("");

  const sectionIndexById = useMemo(() => {
    const m = new Map<string, number>();
    sections.forEach((s, i) => m.set(s.instanceId, i));
    return m;
  }, [sections]);

  // Si no hay ninguna seleccionada, seleccionar la primera (sin scroll)
  useEffect(() => {
    if (!sections.length) {
      setSelectedSectionInstanceId(null);
      return;
    }
    setSelectedSectionInstanceId((cur) => (cur ? cur : sections[0].instanceId));
  }, [sections]);

  // Al seleccionar/cargar una canción nueva: scrollear arriba (respeta flag de animación)
  useEffect(() => {
    const cur = selectedSaved || "";
    if (lastSongRef.current !== cur) {
      lastSongRef.current = cur;
      window.scrollTo({ top: 0, behavior: animateSectionScroll ? "smooth" : "auto" });
    }
  }, [selectedSaved]);

  function scrollToSection(instanceId: string) {
    const el = sectionElsRef.current.get(instanceId);
    if (!el) return;
    const headerH = stickyHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const stickyTop = 12; // coincide con top del sticky
    const extraGap = 10;
    const y = window.scrollY + el.getBoundingClientRect().top;
    const targetTop = Math.max(0, Math.round(y - headerH - stickyTop - extraGap));
    window.scrollTo({ top: targetTop, behavior: animateSectionScroll ? "smooth" : "auto" });
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as any)?.isContentEditable) return;
      if (!sections.length) return;

      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();

      // Si no hay ninguna seleccionada, seleccionar la primera
      if (!selectedSectionInstanceId) {
        const first = sections[0].instanceId;
        setSelectedSectionInstanceId(first);
        scrollToSection(first);
        return;
      }

      const curIdx = sectionIndexById.get(selectedSectionInstanceId) ?? 0;
      const nextIdx =
        e.key === "ArrowRight"
          ? (curIdx + 1) % sections.length
          : (curIdx - 1 + sections.length) % sections.length;
      const nextId = sections[nextIdx]?.instanceId ?? sections[0].instanceId;
      setSelectedSectionInstanceId(nextId);
      scrollToSection(nextId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sections, sectionIndexById, selectedSectionInstanceId]);

  return (
    <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <div
        ref={stickyHeaderRef}
        style={{
          position: "sticky",
          top: 12,
          zIndex: 60,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 10,
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 32 }}>
          <div
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 950,
              textAlign: "center",
              letterSpacing: 0.2,
              color: "rgba(255,255,255,0.95)",
              padding: "0 44px", // deja lugar para el botón de la derecha
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            aria-label="Título de la canción"
            title={selectedSaved || "Sin canción seleccionada"}
          >
            {selectedSaved || <span style={{ opacity: 0.7, fontWeight: 800 }}>Sin canción</span>}
          </div>

          <button
            onClick={onOpenPicker}
            disabled={savedNamesCount === 0}
            aria-label="Seleccionar canción"
            title={savedNamesCount === 0 ? "No hay canciones guardadas" : "Abrir selector de canciones"}
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              padding: "8px 10px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: savedNamesCount === 0 ? "not-allowed" : "pointer",
              opacity: savedNamesCount === 0 ? 0.55 : 1,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <SongTimeline
          song={[]}
          selectedId={selectedId}
          onSelect={onSelectEvent}
          onRemove={onRemoveEvent}
          labelMode={noteLabelMode}
          onReorder={onReorderEvent}
          viewMode="tabs"
          emptyText="Selecciona una cancion o crea una nueva en el modo componer"
          editable={false}
          scale={0.66}
          forceSquare={true}
          invisibleSpaces={true}
          lineBreaksAsNewline={true}
        />
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {sections.map((sec, i) => (
            <div
              key={sec.instanceId}
              ref={(node) => {
                if (node) sectionElsRef.current.set(sec.instanceId, node);
                else sectionElsRef.current.delete(sec.instanceId);
              }}
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {sections.length > 1 ? (
                <div
                  onClick={() => setSelectedSectionInstanceId(sec.instanceId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 4px",
                    borderRadius: 12,
                    background: selectedSectionInstanceId === sec.instanceId ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                    border: selectedSectionInstanceId === sec.instanceId ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  aria-label={`Separador de sección ${sec.name}`}
                >
                  <div style={{ height: 1, background: "rgba(255,255,255,0.14)", flex: 1 }} />
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{sec.name}</div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.14)", flex: 1 }} />
                </div>
              ) : null}

              <SongTimeline
                song={sec.events}
                selectedId={selectedId}
                onSelect={onSelectEvent}
                onRemove={onRemoveEvent}
                labelMode={noteLabelMode}
                onReorder={onReorderEvent}
                viewMode="tabs"
                emptyText=""
                editable={false}
                scale={0.66}
                forceSquare={true}
                invisibleSpaces={true}
                lineBreaksAsNewline={true}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

