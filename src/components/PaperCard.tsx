"use client";

import { Paper, STATUS_CONFIG, ReadingStatus } from "@/lib/types";
import {
  Eye,
  BookOpen,
  GraduationCap,
  FlaskConical,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Calendar,
  Tag,
} from "lucide-react";
import { useState } from "react";

const statusIcons = {
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

const statusDropdownColors: Record<ReadingStatus, string> = {
  glance: "hover:bg-amber-50 hover:text-amber-700",
  read: "hover:bg-blue-50 hover:text-blue-700",
  study: "hover:bg-violet-50 hover:text-violet-700",
  experiment: "hover:bg-emerald-50 hover:text-emerald-700",
  done: "hover:bg-zinc-100 hover:text-zinc-700",
};

interface PaperCardProps {
  paper: Paper;
  onMove: (key: string, status: ReadingStatus) => void;
  onSelect: (paper: Paper) => void;
  collectionNames: Record<string, string>;
}

export default function PaperCard({
  paper,
  onMove,
  onSelect,
  collectionNames,
}: PaperCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const truncatedAbstract =
    paper.abstract.length > 160
      ? paper.abstract.slice(0, 160) + "..."
      : paper.abstract;

  const nonReaderTags = paper.tags.filter((t) => !t.tag.startsWith("reader/"));
  const paperCollections = paper.collections
    .map((c) => collectionNames[c])
    .filter(Boolean);

  return (
    <div
      className="group relative bg-white border border-zinc-200 rounded-xl p-4 shadow-sm
                 hover:border-zinc-300 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={() => onSelect(paper)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-2 flex-1">
          {paper.title}
        </h3>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`p-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${statusColors[paper.status]}`}
          >
            {(() => {
              const Icon = statusIcons[paper.status];
              return <Icon size={12} />;
            })()}
            {STATUS_CONFIG[paper.status].label}
            <ChevronDown size={10} />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Move to
                  </p>
                </div>
                {(
                  ["glance", "read", "study", "experiment", "done"] as ReadingStatus[]
                ).map((status) => {
                  const Icon = statusIcons[status];
                  const isActive = paper.status === status;
                  return (
                    <button
                      key={status}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(paper.key, status);
                        setShowMenu(false);
                      }}
                      disabled={isActive}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                        ${isActive ? "bg-zinc-50 text-zinc-400 cursor-default" : `text-zinc-600 ${statusDropdownColors[status]}`}`}
                    >
                      <Icon size={13} />
                      {STATUS_CONFIG[status].label}
                      {isActive && (
                        <span className="ml-auto text-xs text-zinc-400">
                          current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Authors */}
      {paper.authors && (
        <p className="text-xs text-zinc-400 mb-2 line-clamp-1">
          {paper.authors}
        </p>
      )}

      {/* Abstract */}
      {truncatedAbstract && (
        <p className="text-sm text-zinc-500 leading-relaxed mb-3 line-clamp-3">
          {truncatedAbstract}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 flex-wrap">
        {paper.date && (
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <Calendar size={12} />
            {paper.date}
          </span>
        )}
        {paper.itemType && (
          <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
            {paper.itemType}
          </span>
        )}
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-indigo-600 transition-colors"
          >
            <ExternalLink size={10} />
            Link
          </a>
        )}
      </div>

      {/* Collections & Tags */}
      {(paperCollections.length > 0 || nonReaderTags.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-zinc-100">
          {paperCollections.slice(0, 2).map((name) => (
            <span
              key={name}
              className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
            >
              {name}
            </span>
          ))}
          {nonReaderTags.slice(0, 3).map((t) => (
            <span
              key={t.tag}
              className="flex items-center gap-0.5 text-xs text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded"
            >
              <Tag size={8} />
              {t.tag.length > 20 ? t.tag.slice(0, 20) + "..." : t.tag}
            </span>
          ))}
          {paperCollections.length + nonReaderTags.length > 5 && (
            <span className="text-xs text-zinc-400">
              +{paperCollections.length + nonReaderTags.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
