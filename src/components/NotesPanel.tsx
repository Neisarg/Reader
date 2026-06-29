"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Save, Check, Loader2, Pencil, Eye } from "lucide-react";

interface NotesPanelProps {
  content: string;
  onChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  paperTitle: string;
}

export default function NotesPanel({
  content,
  onChange,
  onSave,
  paperTitle,
}: NotesPanelProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  const handleSave = useCallback(async () => {
    if (saving || !content.trim()) return;
    setSaving(true);
    try {
      await onSave(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* handled in parent */
    } finally {
      setSaving(false);
    }
  }, [content, onSave, saving]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="text-sm font-semibold text-zinc-700">Notes</h3>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">
            {paperTitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit/Preview toggle */}
          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors
                ${viewMode === "edit" ? "bg-zinc-100 text-zinc-700" : "text-zinc-400 hover:text-zinc-600"}`}
            >
              <Pencil size={11} />
              Edit
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors border-l border-zinc-200
                ${viewMode === "preview" ? "bg-zinc-100 text-zinc-700" : "text-zinc-400 hover:text-zinc-600"}`}
            >
              <Eye size={11} />
              Preview
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${
                saved
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
              }`}
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
            )}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`# Notes

Write your notes in **Markdown**.

- Key takeaways
- Questions to investigate
- Connections to other work

> Use blockquotes for important passages

\`\`\`
Code snippets are supported too
\`\`\``}
            className="w-full h-full px-4 py-3 text-base text-zinc-700 leading-relaxed resize-none
                     placeholder:text-zinc-400 bg-transparent font-mono
                     focus:outline-none"
          />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3">
            {content.trim() ? (
              <div className="markdown-body markdown-body-notes">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-base text-zinc-400 italic">
                Nothing to preview yet. Switch to Edit mode to start writing.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-zinc-100 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          {content.length > 0
            ? `${content.split(/\s+/).filter(Boolean).length} words`
            : "No notes yet"}
        </span>
        <span className="text-xs text-zinc-400">
          Markdown supported
        </span>
      </div>
    </div>
  );
}
