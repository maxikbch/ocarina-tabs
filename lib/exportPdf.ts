"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";
import { toPng, toJpeg } from "html-to-image";
import { PDFDocument, StandardFonts } from "pdf-lib";
import StepCard from "@/components/StepCard";
import type { NoteEvent } from "./types";
import type { NoteLabelMode } from "./noteLabels";
import { shiftNote } from "./notes";

function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const m = /^data:([^;,]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl);
  if (!m) {
    throw new Error("Invalid data URL");
  }
  const mime = m[1];
  const isBase64 = !!m[3];
  const data = m[4];
  if (isBase64) {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mime, bytes: out };
  } else {
    const decoded = decodeURIComponent(data);
    const out = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
    return { mime, bytes: out };
  }
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

async function fetchAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if ((img as HTMLImageElement).complete) return res();
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        })
    )
  );
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

export async function exportSongPdf(
  song: NoteEvent[],
  options?: { labelMode?: NoteLabelMode; title?: string; transpose?: number }
) {
  if (song.length === 0) return;
  const labelMode = options?.labelMode ?? "latin";
  const title = options?.title ?? "Canción";
  const transpose = options?.transpose ?? 0;

  await preloadImage("/ocarina.png");
  const ocarinaDataUrl = await fetchAsDataUrl("/ocarina.png");

  const offscreen = document.createElement("div");
  offscreen.style.position = "fixed";
  offscreen.style.left = "-10000px";
  offscreen.style.top = "0";
  offscreen.style.background = "#fff";
  offscreen.style.zIndex = "-1";
  document.body.appendChild(offscreen);

  const roots: Array<{ root: Root; node: HTMLDivElement }> = [];
  type Item = { kind: "image"; dataUrl: string } | { kind: "space" } | { kind: "break" };
  const items: Item[] = [];

  try {
    for (const ev of song) {
      if (ev.note === "—" || ev.note === "SPACE") {
        items.push({ kind: "space" });
        continue;
      }
      if (ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
        items.push({ kind: "break" });
        continue;
      }
      const node = document.createElement("div");
      offscreen.appendChild(node);
      const root = createRoot(node);
      root.render(
        React.createElement(StepCard, {
          note: ev.note,
          fingering: ev.fingering,
          labelMode,
          imageHref: ocarinaDataUrl,
        })
      );
      roots.push({ root, node });
      await waitForImages(node);
      await new Promise((r) => setTimeout(r, 30));
      // Rasterizar
      let dataUrl: string | null = null;
      try {
        dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
        if (!dataUrl || !dataUrl.startsWith("data:")) throw new Error("toPng no devolvió data URL");
      } catch {
        dataUrl = await toJpeg(node, { cacheBust: true, pixelRatio: 2, quality: 0.92, backgroundColor: "#ffffff" });
      }
      items.push({ kind: "image", dataUrl: dataUrl! });
    }

    const pdf = await PDFDocument.create();
    const helv = await pdf.embedFont(StandardFonts.Helvetica);

    const pageMargin = 36;
    const gapX = 8;
    const gapY = 12;
    const cardTargetWidth = 45;

    function addTitledPage() {
      const page = pdf.addPage([595.28, 841.89]); // A4
      const pw = page.getWidth();
      const ph = page.getHeight();
      const textWidth = helv.widthOfTextAtSize(title, 18);
      page.drawText(title, {
        x: (pw - textWidth) / 2,
        y: ph - pageMargin - 18,
        size: 18,
        font: helv,
      });
      return page;
    }

    let page = addTitledPage();
    let pw = page.getWidth();
    let ph = page.getHeight();
    const left = pageMargin;
    const right = pw - pageMargin;
    let x = left;
    let yTop = ph - pageMargin - 18 - 24; // debajo del título

    // Alto actual de la fila (máximo de las tarjetas colocadas en la fila)
    let currentRowHeight = 0;

    const startNewPage = () => {
      page = addTitledPage();
      pw = page.getWidth();
      ph = page.getHeight();
      x = left;
      yTop = ph - pageMargin - 18 - 24;
      currentRowHeight = 0;
    };

    const wrapRow = (minRowHeight = 0) => {
      const rowH = Math.max(currentRowHeight, minRowHeight);
      if (rowH === 0) return;
      yTop -= rowH + gapY;
      x = left;
      currentRowHeight = 0;
    };

    for (const it of items) {
      if (it.kind === "break") {
        // salto de línea explícito (wrap de fila)
        wrapRow();
        if (yTop - 100 < pageMargin) {
          // si ya no queda alto estimado para otra fila, nueva página
          startNewPage();
        }
        continue;
      }

      if (it.kind === "space") {
        // dejar hueco del ancho de una tarjeta (y actualizar fila si no entra)
        if (x + cardTargetWidth > right) {
          wrapRow();
          if (yTop - 100 < pageMargin) startNewPage();
        }
        x += cardTargetWidth + gapX;
        continue;
      }

      const { bytes, mime } = dataUrlToBytes(it.dataUrl);
      const img = /png$/i.test(mime) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const dims = img.scale(1);
      const scale = cardTargetWidth / dims.width;
      const w = cardTargetWidth;
      const h = dims.height * scale;

      // si no entra horizontalmente, wrap a siguiente fila
      if (x + w > right) {
        wrapRow();
      }
      // si no entra verticalmente, nueva página
      if (yTop - h < pageMargin) {
        startNewPage();
      }

      page.drawImage(img, {
        x,
        y: yTop - h,
        width: w,
        height: h,
      });
      x += w + gapX;
      currentRowHeight = Math.max(currentRowHeight, h);
    }

    const pdfBytes = await pdf.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(title || "Cancion Ocarina")}.pdf`;

    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    for (const { root } of roots) root.unmount();
    offscreen.remove();
  }
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.replace(/\s/g, "_") : "Cancion Ocarina";
}


