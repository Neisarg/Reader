"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Paper, ReadingStatus, STATUS_CONFIG } from "@/lib/types";
import { parseItemStatus } from "@/lib/zotero";
import PdfViewer from "@/components/PdfViewer";
import ChatPanel from "@/components/ChatPanel";
import NotesPanel from "@/components/NotesPanel";
import {
  ArrowLeft,
  Eye,
  BookOpen,
  GraduationCap,
  FlaskConical,
  CheckCircle,
  ChevronDown,
  FileText,
  MessageSquare,
  StickyNote,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

const statusIcons: Record<ReadingStatus, typeof Eye> = {
  glance: Eye,
  read: BookOpen,
  study: GraduationCap,
  experiment: FlaskConical,
  done: CheckCircle,
};

const statusColors: Record<ReadingStatus, string> = {
  glance: "bg-amber-50 text-amber-700 border-amber-200",
  read: "bg-blue-50 text-blue-700 border-blue-200",
  study: "bg-violet-50 text-violet-700 border-violet-200",
  experiment: "bg-emerald-50 text-emerald-700 border-emerald-200",
  done: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

interface ZoteroItemData {
  key: string;
  version: number;
  data: {
    key: string;
    itemType: string;
    title: string;
    creators: Array<{
      creatorType: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }>;
    abstractNote?: string;
    date?: string;
    url?: string;
    DOI?: string;
    publicationTitle?: string;
    tags: Array<{ tag: string; type?: number }>;
    collections: string[];
    dateAdded: string;
    dateModified: string;
  };
}

function formatAuthors(
  creators: Array<{
    creatorType: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }>
): string {
  return creators
    .filter((c) => c.creatorType === "author")
    .map((c) =>
      c.name ? c.name : `${c.firstName || ""} ${c.lastName || ""}`.trim()
    )
    .filter(Boolean)
    .join(", ");
}

export default function PaperReadingPage() {
  const params = useParams();
  const router = useRouter();
  const key = params.key as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [rightPanel, setRightPanel] = useState<"chat" | "notes">("chat");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const noteKeyRef = useRef<string | null>(null);
  const noteVersionRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(420);

  // Fetch paper data
  useEffect(() => {
    async function fetchPaper() {
      try {
        const res = await fetch(`/api/zotero/items/${key}`);
        if (!res.ok) throw new Error("Paper not found");
        const item: ZoteroItemData = await res.json();
        setPaperFromItem(item);
      } catch {
        /* Paper not found */
      } finally {
        setLoading(false);
      }
    }

    function setPaperFromItem(item: ZoteroItemData) {
      const status = parseItemStatus(item.data.tags);
      setPaper({
        key: item.data.key,
        version: item.version,
        title: item.data.title || "Untitled",
        authors: formatAuthors(item.data.creators),
        abstract: item.data.abstractNote || "",
        date: item.data.date || "",
        url: item.data.url || "",
        doi: item.data.DOI || "",
        publicationTitle: item.data.publicationTitle || "",
        collections: item.data.collections || [],
        tags: item.data.tags || [],
        dateAdded: item.data.dateAdded,
        dateModified: item.data.dateModified,
        status,
        itemType: item.data.itemType,
      });
    }

    fetchPaper();
  }, [key]);

  // Fetch existing notes
  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch(`/api/zotero/items/${key}/notes`);
        if (!res.ok) return;
        const notes = await res.json();
        const readerNote = notes.find(
          (n: { tags: Array<{ tag: string }> }) =>
            n.tags?.some((t: { tag: string }) => t.tag === "reader/note")
        );
        if (readerNote) {
          noteKeyRef.current = readerNote.key;
          noteVersionRef.current = readerNote.version;
          // Try to extract raw markdown from HTML comment first
          const mdMatch = readerNote.note.match(/<!--READER_MD:([\s\S]*?)-->/);
          if (mdMatch) {
            setNotesContent(mdMatch[1]);
          } else {
            // Fallback: strip HTML tags
            const plainText = readerNote.note
              .replace(/<[^>]*>/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            setNotesContent(plainText);
          }
        }
      } catch {
        /* ignore */
      }
    }
    fetchNotes();
  }, [key]);

  // Drag-to-resize right panel
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = rightPanelWidth;
    },
    [rightPanelWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const delta = dragStartX.current - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * 0.5);
      const newWidth = Math.max(280, Math.min(maxWidth, dragStartWidth.current + delta));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  const handleAddToNotes = useCallback((text: string) => {
    setNotesContent((prev) => {
      const separator = prev.trim() ? "\n\n---\n\n" : "";
      return prev + separator + text;
    });
    setRightPanel("notes");
    setRightPanelOpen(true);
  }, []);

  const handleAskAIFromPdf = useCallback((text: string) => {
    setPendingQuestion(text);
    setRightPanel("chat");
    setRightPanelOpen(true);
  }, []);

  const handleAddToNotesFromPdf = useCallback((text: string) => {
    setNotesContent((prev) => {
      const separator = prev.trim() ? "\n\n---\n\n" : "";
      return prev + separator + `> ${text.replace(/\n/g, "\n> ")}`;
    });
    setRightPanel("notes");
    setRightPanelOpen(true);
  }, []);

  const handleSaveNotes = useCallback(
    async (content: string) => {
      if (!paper) return;
      try {
        // Build HTML with embedded raw markdown for lossless round-trip
        const htmlBody = content
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
          .replace(/\*(.+?)\*/g, "<i>$1</i>")
          .replace(/`(.+?)`/g, "<code>$1</code>")
          .replace(/^- (.+)$/gm, "<li>$1</li>")
          .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
          .replace(/\n{2,}/g, "</p><p>")
          .replace(/\n/g, "<br/>")
          .replace(/^/, "<p>")
          .replace(/$/, "</p>");

        const htmlContent = `<!--READER_MD:${content}--><div><h2>Notes — ${paper.title}</h2>${htmlBody}</div>`;

        if (noteKeyRef.current) {
          // Update existing note
          await fetch(`/api/zotero/items/${paper.key}/notes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              noteKey: noteKeyRef.current,
              version: noteVersionRef.current,
              content: htmlContent,
            }),
          });
          noteVersionRef.current++;
        } else {
          // Create new note
          const res = await fetch(`/api/zotero/items/${paper.key}/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: htmlContent }),
          });
          const result = await res.json();
          // Store the new note's key for future updates
          const successKeys = Object.keys(result.successful || {});
          if (successKeys.length > 0) {
            noteKeyRef.current = result.successful[successKeys[0]].key;
            noteVersionRef.current = result.successful[successKeys[0]].version || 0;
          }
        }
      } catch (err) {
        console.error("Failed to save notes:", err);
      }
    },
    [paper]
  );

  const handleStatusChange = useCallback(
    async (newStatus: ReadingStatus) => {
      if (!paper) return;
      setPaper((prev) => (prev ? { ...prev, status: newStatus } : null));
      setStatusMenuOpen(false);

      const nonReaderTags = paper.tags.filter(
        (t) => !t.tag.startsWith("reader/")
      );
      const newTags = [...nonReaderTags, { tag: `reader/${newStatus}` }];

      try {
        await fetch(`/api/zotero/items/${paper.key}/tags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: paper.version, tags: newTags }),
        });
        setPaper((prev) =>
          prev ? { ...prev, version: prev.version + 1, tags: newTags } : null
        );
      } catch {
        setPaper((prev) =>
          prev ? { ...prev, status: paper.status } : null
        );
      }
    },
    [paper]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-4">
        <p className="text-zinc-500">Paper not found</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          Back to Reader
        </button>
      </div>
    );
  }

  const StatusIcon = statusIcons[paper.status];
  const pdfUrl = paper.url
    ? `/api/pdf?url=${encodeURIComponent(paper.url)}`
    : null;

  return (
    <div
      className="bg-zinc-50"
      style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", gridTemplateColumns: rightPanelOpen ? `1fr 6px ${rightPanelWidth}px` : "1fr", overflow: "hidden" }}
    >
      {/* Top bar — spans full width */}
      <header className="bg-white border-b border-zinc-200 px-4 py-2" style={{ gridColumn: "1 / -1" }}>
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Title & metadata */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-zinc-800 truncate">
              {paper.title}
            </h1>
            <p className="text-xs text-zinc-400 truncate">
              {paper.authors}
              {paper.date ? ` (${paper.date})` : ""}
            </p>
          </div>

          {/* Status selector */}
          <div className="relative" ref={statusMenuRef}>
            <button
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusColors[paper.status]}`}
            >
              <StatusIcon size={14} />
              {STATUS_CONFIG[paper.status].label}
              <ChevronDown size={12} />
            </button>
            {statusMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setStatusMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden">
                  {(
                    [
                      "glance",
                      "read",
                      "study",
                      "experiment",
                      "done",
                    ] as ReadingStatus[]
                  ).map((s) => {
                    const Icon = statusIcons[s];
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                          ${paper.status === s ? "bg-zinc-50 text-zinc-400" : "text-zinc-600 hover:bg-zinc-50"}`}
                      >
                        <Icon size={14} />
                        {STATUS_CONFIG[s].label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right panel tabs */}
          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                setRightPanel("chat");
                setRightPanelOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${rightPanel === "chat" && rightPanelOpen ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              <MessageSquare size={14} />
              Raven
            </button>
            <button
              onClick={() => {
                setRightPanel("notes");
                setRightPanelOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-zinc-200
                ${rightPanel === "notes" && rightPanelOpen ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              <StickyNote size={14} />
              Notes
            </button>
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="px-2 py-1.5 text-zinc-400 hover:text-zinc-600 transition-colors border-l border-zinc-200"
            >
              {rightPanelOpen ? (
                <PanelRightClose size={14} />
              ) : (
                <PanelRightOpen size={14} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* PDF Viewer — grid cell, overflow hidden so PdfViewer handles its own scroll */}
      <div style={{ overflow: "hidden", minHeight: 0, minWidth: 0 }}>
        {pdfUrl ? (
          <PdfViewer url={pdfUrl} paperKey={paper.key} onAskAI={handleAskAIFromPdf} onAddToNotes={handleAddToNotesFromPdf} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
            <FileText size={48} strokeWidth={1} />
            <p className="text-sm">No PDF available</p>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Open paper URL
              </a>
            )}
          </div>
        )}
      </div>

      {/* Drag handle — grid cell */}
      {rightPanelOpen && (
        <div
          onMouseDown={handleDragStart}
          className={`cursor-col-resize relative
            ${isDragging ? "bg-indigo-400" : "bg-zinc-200 hover:bg-indigo-300"} transition-colors`}
          style={{ minHeight: 0 }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Right panel — grid cell */}
      {rightPanelOpen && (
        <div className="bg-white border-l border-zinc-200" style={{ overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: rightPanel === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <ChatPanel
              paper={paper}
              onAddToNotes={handleAddToNotes}
              pendingQuestion={pendingQuestion}
              onPendingQuestionHandled={() => setPendingQuestion(null)}
            />
          </div>
          <div style={{ display: rightPanel === "notes" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <NotesPanel
              content={notesContent}
              onChange={setNotesContent}
              onSave={handleSaveNotes}
              paperTitle={paper.title}
            />
          </div>
        </div>
      )}

      {/* Full-screen overlay during drag to capture mouse over iframes */}
      {isDragging && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: "col-resize" }} />
      )}
    </div>
  );
}
