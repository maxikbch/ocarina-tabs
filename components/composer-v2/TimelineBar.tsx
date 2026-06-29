"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PIANO_ROLL_LABEL_WIDTH } from "@/lib/composerV2Layout";
import { snapTickFloor, tickToBeatLabel } from "@/lib/songTiming";
import type { SongDocV2, TimedEvent, Tick } from "@/lib/songDocV2";
import { getSectionEndTick } from "@/lib/songDocV2";
import type { SnapDivision } from "@/components/composer-v2/TransportBar";
import { getSnapTicks } from "@/components/composer-v2/TransportBar";
import type { TransportState } from "@/components/composer-v2/PianoRoll";

const TIMELINE_HEIGHT = 32;

type PanState = {
  startX: number;
  scrollLeft: number;
};

function tickFromClientX(
  clientX: number,
  scrollEl: HTMLDivElement,
  pxPerTick: number,
  snapDiv: number
): Tick {
  const rect = scrollEl.getBoundingClientRect();
  const x = clientX - rect.left + scrollEl.scrollLeft - PIANO_ROLL_LABEL_WIDTH;
  const raw = Math.max(0, x / pxPerTick);
  return snapTickFloor(raw, snapDiv);
}

export default function TimelineBar({
  doc,
  events,
  pxPerTick,
  playheadTick,
  transportState,
  snap,
  scrollLeft,
  onScrollLeftChange,
  onPlayheadChange,
}: {
  doc: SongDocV2;
  events: TimedEvent[];
  pxPerTick: number;
  playheadTick: Tick;
  transportState: TransportState;
  snap: SnapDivision;
  scrollLeft: number;
  onScrollLeftChange: (left: number) => void;
  onPlayheadChange: (tick: Tick) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [panning, setPanning] = useState<PanState | null>(null);
  const syncingRef = useRef(false);

  const snapDiv = getSnapTicks(doc, snap);

  const contentWidth = useMemo(() => {
    const end = getSectionEndTick(events);
    const minTicks = doc.timing.ppq * 8;
    return Math.max(minTicks, end + doc.timing.ppq * 2) * pxPerTick + PIANO_ROLL_LABEL_WIDTH;
  }, [events, doc.timing.ppq, pxPerTick]);

  const endTick = useMemo(() => {
    const end = getSectionEndTick(events);
    return Math.max(doc.timing.ppq * 8, end + doc.timing.ppq * 2);
  }, [events, doc.timing.ppq]);

  const gridLines = useMemo(() => {
    const ppq = doc.timing.ppq;
    const step = snap === "free" ? ppq : snap === "quarter" ? ppq : snapDiv;
    const lines: Array<{ tick: number; strength: "bar" | "quarter" }> = [];
    for (let tick = 0; tick <= endTick; tick += step) {
      if (tick % (ppq * 4) === 0) lines.push({ tick, strength: "bar" });
      else if (tick % ppq === 0) lines.push({ tick, strength: "quarter" });
    }
    return lines;
  }, [doc.timing.ppq, endTick, snap, snapDiv]);

  const playheadColor =
    transportState === "playing"
      ? "rgba(120, 220, 255, 0.98)"
      : transportState === "paused"
      ? "rgba(255, 200, 80, 0.98)"
      : "rgba(255, 255, 255, 0.92)";

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return;
      onPlayheadChange(tickFromClientX(clientX, el, pxPerTick, snapDiv));
    },
    [onPlayheadChange, pxPerTick, snapDiv]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || syncingRef.current) return;
    if (Math.abs(el.scrollLeft - scrollLeft) < 1) return;
    syncingRef.current = true;
    el.scrollLeft = scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [scrollLeft]);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => seekToClientX(e.clientX);
    const onUp = () => setScrubbing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scrubbing, seekToClientX]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const next = Math.max(0, panning.scrollLeft - (e.clientX - panning.startX));
      el.scrollLeft = next;
      onScrollLeftChange(next);
    };
    const onUp = () => setPanning(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panning, onScrollLeftChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const blockWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", blockWheel, { passive: false });
    return () => el.removeEventListener("wheel", blockWheel);
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || syncingRef.current) return;
    onScrollLeftChange(el.scrollLeft);
  }

  function handlePanStart(e: React.MouseEvent) {
    if (e.button !== 2 || !scrollRef.current) return;
    e.preventDefault();
    setPanning({
      startX: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
    });
  }

  function handleTrackPointerDown(e: React.MouseEvent) {
    if (e.button === 2) return;
    if (e.button !== 0 || transportState === "playing") return;
    e.preventDefault();
    setScrubbing(true);
    seekToClientX(e.clientX);
  }

  const cursor = panning ? "grabbing" : transportState === "playing" ? "default" : "pointer";

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        className="composer-v2-pan-viewport"
        onScroll={handleScroll}
        onMouseDown={handlePanStart}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          height: TIMELINE_HEIGHT,
          cursor,
        }}
      >
        <div
          style={{
            width: contentWidth,
            height: TIMELINE_HEIGHT,
            position: "relative",
            userSelect: "none",
          }}
          onMouseDown={(e) => {
            handlePanStart(e);
            if (e.button !== 2) handleTrackPointerDown(e);
          }}
        >
          <div
            style={{
              position: "sticky",
              left: 0,
              width: PIANO_ROLL_LABEL_WIDTH,
              height: "100%",
              zIndex: 4,
              background: "rgba(0,0,0,0.55)",
              borderRight: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 800,
              opacity: 0.6,
            }}
          >
            Tiempo
          </div>

          {gridLines.map((line) => (
            <div
              key={`tl-grid-${line.tick}`}
              style={{
                position: "absolute",
                left: PIANO_ROLL_LABEL_WIDTH + line.tick * pxPerTick,
                top: 0,
                bottom: 0,
                width: 1,
                background:
                  line.strength === "bar"
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.08)",
                pointerEvents: "none",
              }}
            />
          ))}

          {gridLines
            .filter((l) => l.strength === "bar")
            .map((line) => (
              <div
                key={`tl-label-${line.tick}`}
                style={{
                  position: "absolute",
                  left: PIANO_ROLL_LABEL_WIDTH + line.tick * pxPerTick + 4,
                  top: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  opacity: 0.55,
                  pointerEvents: "none",
                }}
              >
                {tickToBeatLabel(line.tick, doc.timing)}
              </div>
            ))}

          <div
            style={{
              position: "absolute",
              left: PIANO_ROLL_LABEL_WIDTH,
              top: 0,
              width: playheadTick * pxPerTick,
              height: "100%",
              background: "rgba(120, 200, 255, 0.06)",
              pointerEvents: "none",
            }}
          />

          <div
            data-timeline-playhead="1"
            onMouseDown={(e) => {
              if (e.button === 2 || transportState === "playing") return;
              e.stopPropagation();
              setScrubbing(true);
              seekToClientX(e.clientX);
            }}
            style={{
              position: "absolute",
              left: PIANO_ROLL_LABEL_WIDTH + playheadTick * pxPerTick,
              top: 0,
              width: 2,
              height: "100%",
              background: playheadColor,
              boxShadow: `0 0 6px ${playheadColor}`,
              zIndex: 5,
              cursor: transportState === "playing" ? "default" : "ew-resize",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: `8px solid ${playheadColor}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
