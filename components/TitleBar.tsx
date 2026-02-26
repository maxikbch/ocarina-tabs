"use client";

import React, { useState, useEffect } from "react";

const titleBarHeight = 36;

const buttonStyle = {
  width: 46,
  height: titleBarHeight,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.9)",
  cursor: "pointer",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  WebkitAppRegion: "no-drag",
} as React.CSSProperties;

export default function TitleBar({
  onCloseClick,
}: {
  onCloseClick: () => void;
}) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!(window as any).electron);
  }, []);

  if (!isElectron) return null;

  const electron = (window as any).electron;

  const handleMinimize = () => electron.minimize?.();
  const handleMaximize = () => electron.maximize?.();
  const handleClose = () => onCloseClick();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: titleBarHeight,
        minHeight: titleBarHeight,
        background: "#0d0d0d",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        WebkitAppRegion: "drag",
        userSelect: "none",
        flexShrink: 0,
      } as React.CSSProperties}
    >
      <div
        style={{
          paddingLeft: 14,
          fontSize: 13,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.02em",
        }}
      >
        Ocarina Tabs
      </div>
      <div style={{ display: "flex", height: titleBarHeight }}>
        <button
          type="button"
          aria-label="Minimizar"
          style={buttonStyle}
          onClick={handleMinimize}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          —
        </button>
        <button
          type="button"
          aria-label="Maximizar o restaurar"
          style={buttonStyle}
          onClick={handleMaximize}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          □
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          style={{
            ...buttonStyle,
            width: 46,
          }}
          onClick={handleClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e81123";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
