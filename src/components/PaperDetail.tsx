"use client";

import { Paper, STATUS_CONFIG, ReadingStatus } from "@/lib/types";
import {
  X,
  ExternalLink,
  Eye,
  BookOpen,
  GraduationCap,
  FlaskConical,
  CheckCircle,
  Calendar,
  Tag,
  FileText,
} from "lucide-react";

const statusIcons = {
  glance: Eye,
  read: BookOpen,
  study: GraduationCap,
  experiment: FlaskConical,
  done: CheckCircle,
};

const statusBg: Record<ReadingStatus, string> = {
  glance: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  read: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  study: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  experiment: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  done: "bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200",
};

const statusBgActive: Record<ReadingStatus, string> = {
  glance: "bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300",
  read: "bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-300",
  study: "bg-violet-100 text-violet-800 border-violet-300 ring-1 ring-violet-300",
  experiment: "bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300",
  done: "bg-zinc-200 text-zinc-700 border-zinc-400 ring-1 ring-zinc-400",
};

interface PaperDetailProps {
  paper: Paper;
  onClose: () => void;
  onMove: (key: string, status: ReadingStatus) => void;
  collectionNames: Record<string, string>;
}

export default function PaperDetail({
  paper,
  onClose,
  onMove,
  collectionNames,
}: PaperDetailProps) {
  const nonReaderTags = paper.tags.filter((t) => !t.tag.startsWith("reader/"));
  const paperCollections = paper.collections
    .map((c) => collectionNames[c])
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border border-zinc-200
                    rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-100 text-zinc-400 hover:text-zinc-600
                     hover:bg-zinc-200 transition-colors z-10"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Item type badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
              <FileText size={11} />
              {paper.itemType}
            </span>
            {paper.date && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar size={11} />
                {paper.date}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-zinc-800 leading-tight mb-2 pr-8">
            {paper.title}
          </h2>

          {/* Authors */}
          {paper.authors && (
            <p className="text-sm text-zinc-500 mb-4">{paper.authors}</p>
          )}

          {/* Publication */}
          {paper.publicationTitle && (
            <p className="text-sm text-indigo-500 italic mb-4">
              {paper.publicationTitle}
            </p>
          )}

          {/* Links */}
          <div className="flex items-center gap-3 mb-5">
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <ExternalLink size={13} />
                Open URL
              </a>
            )}
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <ExternalLink size={13} />
                DOI
              </a>
            )}
          </div>

          {/* Reading Status Controls */}
          <div className="bg-zinc-50 rounded-xl p-4 mb-5 border border-zinc-200">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Reading Status
            </p>
            <div className="flex items-center gap-2">
              {(
                ["glance", "read", "study", "experiment", "done"] as ReadingStatus[]
              ).map((status) => {
                const Icon = statusIcons[status];
                const isActive = paper.status === status;
                return (
                  <button
                    key={status}
                    onClick={() => onMove(paper.key, status)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium
                      transition-all duration-150
                      ${isActive ? statusBgActive[status] : statusBg[status]}`}
                  >
                    <Icon size={13} />
                    {STATUS_CONFIG[status].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Abstract */}
          {paper.abstract && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Abstract
              </p>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {paper.abstract}
              </p>
            </div>
          )}

          {/* Collections */}
          {paperCollections.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Collections
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paperCollections.map((name) => (
                  <span
                    key={name}
                    className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {nonReaderTags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {nonReaderTags.map((t) => (
                  <span
                    key={t.tag}
                    className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200"
                  >
                    <Tag size={9} />
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
