"use client";

import React from "react";

export function ToolbarSeparator() {
  return (
    <span
      role="separator"
      style={{
        width: 1,
        height: 20,
        background: "rgba(255,255,255,0.12)",
        margin: "0 4px",
        flexShrink: 0,
      }}
    />
  );
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  fontSize = 12,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  fontSize?: number;
}) {
  const switchId = id ?? `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label
      htmlFor={switchId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        userSelect: "none",
      }}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: 34,
          height: 18,
          borderRadius: 9,
          border: checked ? "1px solid rgba(120, 200, 140, 0.5)" : "1px solid rgba(255,255,255,0.18)",
          background: checked ? "rgba(40, 72, 52, 0.85)" : "#1f1f1f",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: 0,
          flexShrink: 0,
          transition: "background 0.15s ease, border-color 0.15s ease",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 17 : 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: checked ? "#b8e6c8" : "rgba(255,255,255,0.75)",
            transition: "left 0.15s ease, background 0.15s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
        />
      </button>
      {label}
    </label>
  );
}
