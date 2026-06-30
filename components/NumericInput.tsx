"use client";

import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { iconProps } from "@/components/icons";

export default function NumericInput({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  disabled = false,
  ariaLabel = "Valor numérico",
  inputWidth = 40,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  inputWidth?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  function clamp(n: number) {
    return Math.max(min, Math.min(max, n));
  }

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(String(value));
      return;
    }
    const parsed = Number(trimmed);
    const next = Number.isFinite(parsed) ? clamp(Math.round(parsed)) : value;
    onChange(next);
    setDraft(String(next));
  }

  function stepBy(delta: number) {
    const next = clamp(value + delta);
    onChange(next);
    setDraft(String(next));
  }

  const segmentBtn: React.CSSProperties = {
    padding: "4px 8px",
    border: "none",
    background: "transparent",
    color: "#eaeaea",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.45 : 1,
    flexShrink: 0,
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "#1a1a1a",
        overflow: "hidden",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        aria-label="Disminuir"
        disabled={disabled || atMin}
        onClick={() => stepBy(-step)}
        style={{
          ...segmentBtn,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          opacity: disabled || atMin ? 0.35 : 1,
          cursor: disabled || atMin ? "not-allowed" : "pointer",
        }}
      >
        <Minus {...iconProps(14)} />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d]/g, "");
          setDraft(next);
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
            inputRef.current?.blur();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            stepBy(step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            stepBy(-step);
          }
        }}
        style={{
          width: inputWidth,
          padding: "4px 4px",
          border: "none",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          borderRight: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "#eaeaea",
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          outline: "none",
          MozAppearance: "textfield",
        }}
      />
      <button
        type="button"
        aria-label="Aumentar"
        disabled={disabled || atMax}
        onClick={() => stepBy(step)}
        style={{
          ...segmentBtn,
          opacity: disabled || atMax ? 0.35 : 1,
          cursor: disabled || atMax ? "not-allowed" : "pointer",
        }}
      >
        <Plus {...iconProps(14)} />
      </button>
    </div>
  );
}
