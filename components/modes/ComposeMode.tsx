"use client";

import React, { useRef, useState } from "react";
import { FileMusic, FilePlus, ListMusic, Pencil, Save, Trash2 } from "lucide-react";
import ComposerWorkspace from "@/components/composer/ComposerWorkspace";
import { IconLabel, iconProps } from "@/components/icons";
import MidiImportModal from "@/components/composer/MidiImportModal";
import ConfirmModal from "@/components/ConfirmModal";
import type { NoteLabelMode } from "@/lib/noteLabels";
import type { SongDocV2 } from "@/lib/songDocV2";
import {
  mergeMidiImportAsNewSection,
  parseMidiToSongDoc,
  replaceDocWithMidiImport,
  type MidiImportResult,
} from "@/lib/midiImport";
import { docHasNotes } from "@/lib/songVoices";

export default function ComposeMode({
  notes,
  noteLabelMode,
  doc,
  onDocChange,
  transpose,
  onTransposeDec,
  onTransposeInc,
  onPreviewNote,
  selectedSaved,
  savedNamesCount,
  songLength,
  onNewSong,
  onOpenSave,
  onOpenPicker,
  onDeleteSaved,
  onOpenRename,
  stickyTopOffset = 12,
}: {
  notes: string[];
  noteLabelMode: NoteLabelMode;
  doc: SongDocV2;
  onDocChange: (next: SongDocV2) => void;
  transpose: number;
  onTransposeDec: () => void;
  onTransposeInc: () => void;
  onPreviewNote: (note: string) => void | Promise<void>;
  selectedSaved: string;
  savedNamesCount: number;
  songLength: number;
  onNewSong: () => void;
  onOpenSave: () => void;
  onOpenPicker: () => void;
  onDeleteSaved: () => void | Promise<void>;
  onOpenRename: () => void;
  stickyTopOffset?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<MidiImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function openFilePicker() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const result = parseMidiToSongDoc(buffer, file.name);
      setPendingImport(result);
      setImportModalOpen(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "No se pudo leer el archivo MIDI.");
    }
  }

  function closeImportFlow() {
    setImportModalOpen(false);
    setReplaceConfirmOpen(false);
    setPendingImport(null);
  }

  function applyReplace() {
    if (!pendingImport) return;
    onDocChange(replaceDocWithMidiImport(pendingImport.doc));
    closeImportFlow();
  }

  function handleReplaceRequest() {
    if (!pendingImport) return;
    if (docHasNotes(doc)) {
      setImportModalOpen(false);
      setReplaceConfirmOpen(true);
    } else {
      applyReplace();
    }
  }

  function handleNewSection() {
    if (!pendingImport) return;
    onDocChange(mergeMidiImportAsNewSection(doc, pendingImport.doc));
    closeImportFlow();
  }

  return (
    <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e)}
      />

      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
        Componer
        {selectedSaved ? (
          <>
            <span style={{ fontWeight: 400, opacity: 0.8 }}> — "{selectedSaved}"</span>
            <button
              onClick={onOpenRename}
              title="Renombrar canción"
              aria-label="Renombrar canción"
              style={{
                marginLeft: 8,
                padding: "2px 6px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#eaeaea",
                cursor: "pointer",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil {...iconProps(14)} />
            </button>
          </>
        ) : null}
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onNewSong}
            style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center" }}
          >
            <IconLabel icon={FilePlus}>Nueva canción</IconLabel>
          </button>
          <button
            onClick={openFilePicker}
            style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(120, 180, 255, 0.35)", display: "inline-flex", alignItems: "center" }}
          >
            <IconLabel icon={FileMusic}>Importar MIDI</IconLabel>
          </button>
          <button
            onClick={onOpenSave}
            disabled={songLength === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: songLength === 0 ? 0.5 : 1,
              cursor: songLength === 0 ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconLabel icon={Save}>Guardar canción</IconLabel>
          </button>
          <button
            onClick={onDeleteSaved}
            disabled={!selectedSaved}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: !selectedSaved ? 0.5 : 1,
              cursor: !selectedSaved ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconLabel icon={Trash2}>Borrar canción</IconLabel>
          </button>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={onOpenPicker}
            disabled={savedNamesCount === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: savedNamesCount === 0 ? 0.5 : 1,
              cursor: savedNamesCount === 0 ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconLabel icon={ListMusic}>Seleccionar canción</IconLabel>
          </button>
        </div>
      </div>

      {importError ? (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(160, 50, 50, 0.25)",
            border: "1px solid rgba(255, 80, 80, 0.35)",
            color: "#ffd0d0",
            fontSize: 13,
          }}
        >
          {importError}
        </div>
      ) : null}

      <MidiImportModal
        open={importModalOpen && !!pendingImport}
        fileName={pendingImport?.doc.importSource?.fileName ?? "archivo.mid"}
        warnings={pendingImport?.warnings ?? []}
        hasExistingContent={docHasNotes(doc)}
        onCancel={closeImportFlow}
        onReplace={handleReplaceRequest}
        onNewSection={handleNewSection}
      />

      <ConfirmModal
        open={replaceConfirmOpen && !!pendingImport}
        title="Reemplazar canción"
        message={
          "La canción actual tiene contenido que se perderá.\n\n¿Reemplazar todo con el MIDI importado?"
        }
        onCancel={() => {
          setReplaceConfirmOpen(false);
          setImportModalOpen(true);
        }}
        onConfirm={applyReplace}
        zIndex={1170}
      />

      <ComposerWorkspace
        notes={notes}
        labelMode={noteLabelMode}
        doc={doc}
        onDocChange={onDocChange}
        transpose={transpose}
        onTransposeDec={onTransposeDec}
        onTransposeInc={onTransposeInc}
        onPreviewNote={onPreviewNote}
        stickyTopOffset={stickyTopOffset}
      />
    </section>
  );
}
