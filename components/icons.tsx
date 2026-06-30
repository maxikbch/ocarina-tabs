"use client";

import React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, X, type LucideIcon, type LucideProps } from "lucide-react";

export const ICON_SIZE = 16;
export const ICON_SIZE_SM = 14;
export const ICON_SIZE_LG = 18;

export function iconProps(size: number = ICON_SIZE): Pick<LucideProps, "size" | "strokeWidth"> {
  return { size, strokeWidth: 2 };
}

export function IconLabel({
  icon: Icon,
  children,
  size = ICON_SIZE_SM,
  gap = 6,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  size?: number;
  gap?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <Icon {...iconProps(size)} />
      {children}
    </span>
  );
}

export function ModalCloseButton({ onClick, label = "Cerrar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginLeft: "auto",
        background: "none",
        color: "#eaeaea",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      }}
      aria-label={label}
      title={label}
    >
      <X {...iconProps(ICON_SIZE_LG)} />
    </button>
  );
}

export function SortIndicator({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  const props = { size: 12, strokeWidth: 2, style: { flexShrink: 0 } as React.CSSProperties };
  if (!active) return <ChevronsUpDown {...props} style={{ ...props.style, opacity: 0.45 }} />;
  return dir === "asc" ? <ChevronUp {...props} /> : <ChevronDown {...props} />;
}

export function DeleteIcon({ size = ICON_SIZE_SM }: { size?: number }) {
  return <X {...iconProps(size)} />;
}
