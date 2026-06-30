"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  ZoomIn,
  ZoomOut,
  PanelLeftOpen,
  PanelLeftClose,
  Highlighter,
  MousePointer2,
  Eraser,
  Trash2,
  Save,
  Check,
  Loader2,
  Sparkles,
  ClipboardCopy,
  X,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface HighlightRect {
  x: number; y: number; width: number; height: number; // percentages
}

interface HighlightData {
  id: string;
  pageNumber: number;
  color: string;
  text: string;
  rects: HighlightRect[];
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
];

interface PdfViewerProps {
  url: string;
  paperKey: string;
  onAskAI?: (text: string) => void;
  onAddToNotes?: (text: string) => void;
}

export default function PdfViewer({ url, paperKey, onAskAI, onAddToNotes }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [mode, setMode] = useState<"select" | "highlight" | "eraser">("select");
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const pendingHighlightData = useRef<{ pageNumber: number; rects: HighlightRect[]; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load highlights from Zotero, fallback to localStorage
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/highlights?paperKey=${paperKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.highlights && data.highlights.length > 0) {
            setHighlights(data.highlights);
            localStorage.setItem(`reader_hl_${paperKey}`, JSON.stringify(data.highlights));
            return;
          }
        }
      } catch { /* ignore */ }
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(`reader_hl_${paperKey}`);
        if (raw) setHighlights(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    load();
  }, [paperKey]);

  // Ref that always points to the latest highlights for use in callbacks
  const highlightsRef = useRef<HighlightData[]>(highlights);
  highlightsRef.current = highlights;

  // Persist to localStorage immediately, debounce server sync (2s)
  const persistHighlights = useCallback((updated: HighlightData[]) => {
    setHighlights(updated);
    setDirty(true);
    localStorage.setItem(`reader_hl_${paperKey}`, JSON.stringify(updated));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlights: updated, paperKey }),
        });
      } catch { /* silent */ }
    }, 2000);
  }, [paperKey]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  // Track current page on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      let closestPage = 1;
      let closestDistance = Infinity;

      pageRefs.current.forEach((element, pageNum) => {
        const rect = element.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNum;
        }
      });
      setCurrentPage(closestPage);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [numPages]);

  // Dismiss popup
  const dismissPopup = useCallback(() => {
    setSelectedText(null);
    setPopupPos(null);
  }, []);

  // Capture selection rects from current browser selection
  const captureSelectionRects = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

    const text = selection.toString().trim();
    if (!text) return null;

    const range = selection.getRangeAt(0);
    let pageElement: HTMLElement | null = range.startContainer.parentElement;
    let pageNum = 0;
    while (pageElement) {
      const attr = pageElement.getAttribute("data-page-number");
      if (attr) { pageNum = parseInt(attr); break; }
      pageElement = pageElement.parentElement;
    }
    if (!pageNum || !pageElement) return null;

    const pageRect = pageElement.getBoundingClientRect();
    const clientRects = range.getClientRects();
    const rects: HighlightRect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      const rw = (rect.width / pageRect.width) * 100;
      const rh = (rect.height / pageRect.height) * 100;
      if (rw > 90 || rh > 10 || rw < 0.5 || rh < 0.1) continue;
      rects.push({
        x: ((rect.left - pageRect.left) / pageRect.width) * 100,
        y: ((rect.top - pageRect.top) / pageRect.height) * 100,
        width: rw,
        height: rh,
      });
    }
    if (rects.length === 0) return null;
    return { pageNumber: pageNum, rects, text };
  }, []);

  // Apply highlight from stored pending data
  const highlightSelection = useCallback(() => {
    const data = pendingHighlightData.current;
    if (!data) return;

    const highlight: HighlightData = {
      id: `hl_${Date.now()}`,
      pageNumber: data.pageNumber,
      color: highlightColor,
      text: data.text,
      rects: data.rects,
    };
    persistHighlights([...highlightsRef.current, highlight]);
    window.getSelection()?.removeAllRanges();
    pendingHighlightData.current = null;
    dismissPopup();
  }, [highlightColor, persistHighlights, dismissPopup]);

  // Handle text selection — capture rects and show popup
  const handleTextSelection = useCallback(() => {
    if (mode === "eraser") return;

    const data = captureSelectionRects();
    if (!data) return;

    // Store the selection data for later use by popup buttons
    pendingHighlightData.current = data;

    // Show popup
    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      setSelectedText(data.text);
      setPopupPos({
        x: Math.max(10, rect.left - containerRect.left + rect.width / 2 - 80),
        y: Math.max(10, rect.top - containerRect.top - 45 + container.scrollTop),
      });
    }

    // In highlight mode, auto-highlight immediately
    if (mode === "highlight") {
      highlightSelection();
    }
  }, [mode, captureSelectionRects, highlightSelection]);

  const deleteHighlight = useCallback((id: string) => {
    persistHighlights(highlightsRef.current.filter((h) => h.id !== id));
  }, [persistHighlights]);

  const goToPage = useCallback((pg: number) => {
    const el = pageRefs.current.get(pg);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)));

  // Save highlights — local file + annotated PDF uploaded to Zotero
  const saveHighlights = useCallback(async () => {
    if (saving) return;
    // Cancel any pending debounced auto-save to prevent races
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaving(true);
    try {
      await Promise.allSettled([
        // Save highlight data locally
        fetch("/api/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlights, paperKey }),
        }),
        // Embed in PDF and upload to Zotero (only if there are highlights)
        ...(highlights.length > 0
          ? [fetch("/api/highlights/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pdfUrl: url, highlights, paperKey }),
            })]
          : []),
      ]);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [highlights, paperKey, url, saving]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 border-b border-zinc-200 flex-shrink-0">
        {/* Left */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded transition-colors ${showSidebar ? "bg-zinc-200 text-zinc-700" : "hover:bg-zinc-200 text-zinc-500"}`}>
            {showSidebar ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <div className="w-px h-5 bg-zinc-300 mx-0.5" />
          <span className="text-sm text-zinc-600 min-w-[80px] text-center">
            {currentPage} / {numPages || "..."}
          </span>
        </div>

        {/* Center: tools */}
        <div className="flex items-center gap-1">
          <button onClick={() => setMode("select")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
              ${mode === "select" ? "bg-indigo-100 text-indigo-800 border border-indigo-300" : "hover:bg-zinc-200 text-zinc-600"}`}>
            <MousePointer2 size={14} /> Select
          </button>
          <button onClick={() => setMode("highlight")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
              ${mode === "highlight" ? "bg-yellow-100 text-yellow-800 border border-yellow-300" : "hover:bg-zinc-200 text-zinc-600"}`}>
            <Highlighter size={14} /> Highlight
          </button>
          <button onClick={() => setMode("eraser")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
              ${mode === "eraser" ? "bg-red-100 text-red-800 border border-red-300" : "hover:bg-zinc-200 text-zinc-600"}`}>
            <Eraser size={14} /> Eraser
          </button>
          {mode === "highlight" && (
            <div className="flex items-center gap-1 ml-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c.name} onClick={() => setHighlightColor(c.value)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform
                    ${highlightColor === c.value ? "scale-125 border-zinc-700" : "border-zinc-300 hover:scale-110"}`}
                  style={{ backgroundColor: c.value }} title={c.name} />
              ))}
            </div>
          )}
          {(highlights.length > 0 || dirty) && (
            <>
              <div className="w-px h-5 bg-zinc-300 mx-1" />
              {highlights.length > 0 && <span className="text-xs text-zinc-400">{highlights.length}</span>}
              <button onClick={saveHighlights} disabled={saving}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${saved ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"}`}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
                {saved ? "Saved" : "Save"}
              </button>
            </>
          )}
        </div>

        {/* Right: zoom */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="p-1.5 rounded hover:bg-zinc-200"><ZoomOut size={16} /></button>
          <span className="text-xs text-zinc-500 min-w-[45px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 rounded hover:bg-zinc-200"><ZoomIn size={16} /></button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Sidebar: page list */}
        {showSidebar && (
          <div style={{ width: 120, flexShrink: 0, overflowY: "auto" }} className="bg-zinc-50 border-r border-zinc-200 py-2 px-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
              <button key={pg} onClick={() => goToPage(pg)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors mb-0.5
                  ${pg === currentPage ? "bg-indigo-100 text-indigo-700 font-medium" : "text-zinc-500 hover:bg-zinc-100"}`}>
                Page {pg}
              </button>
            ))}
          </div>
        )}

        {/* PDF */}
        <div ref={containerRef} onMouseUp={handleTextSelection}
          onMouseDown={(e) => {
            // Only dismiss if clicking outside the popup
            const popup = (e.target as HTMLElement).closest("[data-popup]");
            if (!popup) dismissPopup();
          }}
          style={{ flex: 1, overflowY: "auto", position: "relative", cursor: mode === "eraser" ? "crosshair" : "text" }}
          className="bg-zinc-200/50">
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="flex items-center justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}
            className="flex flex-col items-center gap-4 py-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const pageHighlights = highlights.filter((h) => h.pageNumber === pageNum);
              return (
                <div key={pageNum} className="relative shadow"
                  ref={(el) => { if (el) pageRefs.current.set(pageNum, el); }}>
                  <Page pageNumber={pageNum} scale={scale}
                    renderTextLayer={true} renderAnnotationLayer={true}
                    loading={<div style={{ width: 612 * scale, height: 792 * scale }} className="bg-white flex items-center justify-center"><div className="animate-spin w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full" /></div>} />

                  {/* Highlight overlays */}
                  {pageHighlights.map((hl) => (
                    <div key={hl.id} className="absolute inset-0" style={{ pointerEvents: "none", zIndex: mode === "eraser" ? 10 : 1 }}>
                      {hl.rects.map((rect, i) => (
                        <div key={i}
                          onClick={mode === "eraser" ? (e) => { e.stopPropagation(); deleteHighlight(hl.id); } : undefined}
                          title={mode === "eraser" ? "Click to remove" : undefined}
                          style={{
                            position: "absolute",
                            left: `${rect.x}%`,
                            top: `${rect.y}%`,
                            width: `${rect.width}%`,
                            height: `${rect.height}%`,
                            backgroundColor: hl.color,
                            opacity: 0.4,
                            pointerEvents: mode === "eraser" ? "auto" : "none",
                            cursor: mode === "eraser" ? "pointer" : "default",
                            mixBlendMode: "multiply",
                          }} />
                      ))}
                    </div>
                  ))}

                  {/* Page number */}
                  <div className="absolute bottom-2 right-3 text-xs text-zinc-400 bg-white/80 px-1.5 py-0.5 rounded">
                    {pageNum}
                  </div>
                </div>
              );
            })}
          </Document>

          {/* Floating popup — Highlight + Ask AI */}
          {selectedText && popupPos && (
            <div
              data-popup
              className="absolute bg-white border border-zinc-200 rounded-xl shadow-2xl flex items-center gap-0.5 p-1.5"
              style={{ left: popupPos.x, top: popupPos.y, zIndex: 50 }}
            >
              <button
                onClick={() => { highlightSelection(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-yellow-800 hover:bg-yellow-50 transition-colors"
              >
                <Highlighter size={13} /> Highlight
              </button>
              {onAskAI && (
                <>
                  <div className="w-px h-5 bg-zinc-200" />
                  <button
                    onClick={() => { onAskAI(selectedText); dismissPopup(); window.getSelection()?.removeAllRanges(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    <Sparkles size={13} /> Ask AI
                  </button>
                </>
              )}
              <div className="w-px h-5 bg-zinc-200" />
              <button
                onClick={() => { dismissPopup(); window.getSelection()?.removeAllRanges(); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-50 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
