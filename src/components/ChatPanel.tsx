"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Paper } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Send,
  Loader2,
  StickyNote,
  Trash2,
  BookOpenCheck,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}


interface ChatPanelProps {
  paper: Paper;
  onAddToNotes: (text: string) => void;
  pendingQuestion?: string | null;
  onPendingQuestionHandled?: () => void;
}

type LogEntry = { time: string; message: string; status: "loading" | "done" | "error" };

export default function ChatPanel({ paper, onAddToNotes, pendingQuestion, onPendingQuestionHandled }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paperText, setPaperText] = useState<string | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initStarted = useRef(false);

  // Single init: extract text then prime Raven
  useEffect(() => {
    if (!paper.url || initStarted.current) return;
    initStarted.current = true;

    const time = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    setLogs([{ time: time(), message: "Extracting paper text...", status: "loading" }]);

    fetch(`/api/pdf/text?url=${encodeURIComponent(paper.url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.text) {
          setLogs([{ time: time(), message: "Could not extract text — Raven will use metadata only", status: "error" }]);
          setContextReady(true);
          return;
        }
        setPaperText(data.text);
        setContextReady(true);
        setLogs([
          { time: time(), message: `Paper loaded (${Math.round(data.text.length / 1000)}k chars)`, status: "done" },
          { time: time(), message: "Raven is ready", status: "done" },
        ]);
      })
      .catch(() => {
        setContextReady(true);
        setLogs([{ time: time(), message: "Text extraction failed — Raven will use metadata only", status: "error" }]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle incoming question from PDF text selection
  useEffect(() => {
    if (pendingQuestion && !streaming) {
      setInput(`Explain this from the paper:\n\n"${pendingQuestion}"`);
      onPendingQuestionHandled?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pendingQuestion, streaming, onPendingQuestionHandled]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent, directPrompt?: string) => {
      e?.preventDefault();
      const trimmed = (directPrompt || input).trim();
      if (!trimmed || streaming) return;
      if (!directPrompt) setInput("");

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      if (directPrompt) setInput("");
      setStreaming(true);
      setError(null);

      try {
        const allMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: trimmed },
        ];

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            paperContext: {
              title: paper.title,
              authors: paper.authors,
              date: paper.date,
              abstract: paper.abstract,
              publicationTitle: paper.publicationTitle,
              url: paper.url,
              fullText: paperText,
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Chat request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      last.content += parsed.text;
                    }
                    return updated;
                  });
                }
              } catch {
                /* skip malformed chunks */
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat failed");
        // Remove empty assistant message on error
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && !last.content) {
            updated.pop();
          }
          return updated;
        });
      } finally {
        setStreaming(false);
      }
    },
    [input, streaming, messages, paper, paperText]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickPrompts = [
    "Summarize this paper in 3 bullet points",
    "What are the key contributions?",
    "Explain the methodology",
    "What are the limitations?",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenCheck size={16} className="text-indigo-500" />
            <h3 className="text-sm font-semibold text-zinc-700">Raven</h3>
          </div>

          <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">via Claude Code</span>
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">
          Ask questions about this paper
        </p>
      </div>

      {/* Status logs */}
      {logs.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-zinc-100 bg-zinc-50/50">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              {log.status === "loading" ? (
                <Loader2 size={10} className="animate-spin text-indigo-400" />
              ) : log.status === "error" ? (
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
              )}
              <span className={`text-[11px] ${log.status === "error" ? "text-red-500" : "text-zinc-400"}`}>{log.message}</span>
              <span className="text-[9px] text-zinc-300 ml-auto">{log.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-4">
            {!contextReady && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-400">
                <Loader2 size={14} className="animate-spin text-indigo-400" />
                Loading paper into Raven...
              </div>
            )}
            {contextReady && (
              <>
                <p className="text-xs text-zinc-400 text-center mb-4">
                  Quick prompts to get started:
                </p>
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(undefined, prompt)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-600 bg-zinc-50 rounded-lg
                             hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-zinc-100"
                  >
                    {prompt}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="group">
            <div
              className={`text-xs font-medium mb-1 flex items-center gap-1.5 ${
                message.role === "user" ? "text-indigo-600" : "text-zinc-500"
              }`}
            >
              {message.role === "user" ? "You" : (
                <><BookOpenCheck size={11} /> Raven</>
              )}
            </div>
            {message.role === "user" ? (
              <div className="text-sm leading-relaxed rounded-lg px-3 py-2 bg-indigo-50 text-zinc-700">
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ) : (
              <div className="rounded-lg px-3 py-2 bg-zinc-50/80 border border-zinc-100">
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.content && !streaming && (
                  <div className="mt-2 pt-2 border-t border-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onAddToNotes(message.content)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-600 transition-colors"
                    >
                      <StickyNote size={12} />
                      Add to notes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 size={12} className="animate-spin" />
            Raven is thinking...
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-100 p-3">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Trash2 size={11} />
              Clear chat
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this paper..."
            rows={2}
            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700
                     placeholder:text-zinc-400 resize-none
                     focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="self-end p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
