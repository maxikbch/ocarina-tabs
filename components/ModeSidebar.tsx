"use client";

import React, { useEffect, useRef, useState } from "react";
import type { NoteLabelMode } from "@/lib/noteLabels";

export type AppMode = "tocar" | "componer" | "repertorio";

function SidebarIconButton({
  active,
  icon,
  label,
  tooltip,
  onClick,
  uniformBorder = false,
  uniformBackground = false,
  autoOpenToken,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  uniformBorder?: boolean;
  uniformBackground?: boolean;
  autoOpenToken?: number;
}) {
  const [open, setOpen] = useState(false);
  const tooltipTimerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof autoOpenToken !== "number") return;
    setOpen(true);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setOpen(false);
      tooltipTimerRef.current = null;
    }, 1400);
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, [autoOpenToken]);

  return (
    <div
      style={{ position: "relative", width: 40, height: 40 }}
      onMouseEnter={() => {
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
        }
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        onFocus={() => {
          if (tooltipTimerRef.current) {
            clearTimeout(tooltipTimerRef.current);
            tooltipTimerRef.current = null;
          }
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        style={{
          height: 44,
          width: 44,
          borderRadius: 12,
          border: uniformBorder ? "1px solid rgba(255,255,255,0.18)" : active ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.18)",
          background: uniformBackground ? "#1f1f1f" : active ? "#333" : "#1f1f1f",
          color: "#eaeaea",
          cursor: "pointer",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: 52,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(32,32,32,0.98)",
            color: "#eaeaea",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 12,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            zIndex: 2000,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

export default function ModeSidebar({
  mode,
  onModeChange,
  noteLabelMode,
  onToggleNotation,
}: {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  noteLabelMode: NoteLabelMode;
  onToggleNotation: () => void;
}) {
  const [notationTooltipToken, setNotationTooltipToken] = useState(0);

  return (
    <aside
      style={{
        width: "fit-content",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        background: "#111",
        borderRight: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "8px 0 28px rgba(0,0,0,0.25)",
        zIndex: 900,
      }}
      aria-label="Sidebar de modo"
    >
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.2,
            color: "rgba(255,255,255,0.75)",
            marginTop: 2,
            marginBottom: 2,
            userSelect: "none",
          }}
        >
          Modo
        </div>
        <SidebarIconButton active={mode === "tocar"} icon={"▶"} label="Modo: tocar" tooltip="Tocar" onClick={() => onModeChange("tocar")} />
        <SidebarIconButton active={mode === "componer"} icon={"✎"} label="Modo: componer" tooltip="Componer" onClick={() => onModeChange("componer")} />
        <SidebarIconButton active={mode === "repertorio"} icon={"☰"} label="Modo: compendio" tooltip="Compendio" onClick={() => onModeChange("repertorio")} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)", display: "grid", gap: 10, justifyItems: "center" }}>
        <SidebarIconButton
          active={noteLabelMode === "latin"}
          icon={noteLabelMode === "latin" ? "Do" : "A"}
          label="Cambiar notación"
          tooltip={noteLabelMode === "latin" ? "Notación latina" : "Notación anglosajona"}
          uniformBorder={true}
          uniformBackground={true}
          autoOpenToken={notationTooltipToken}
          onClick={() => {
            onToggleNotation();
            setNotationTooltipToken((t) => t + 1);
          }}
        />
      </div>
    </aside>
  );
}

