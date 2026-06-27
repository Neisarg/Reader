"use client";

import { Paper, ReadingStatus, STATUS_CONFIG } from "@/lib/types";
import {
  Eye,
  BookOpen,
  GraduationCap,
  FlaskConical,
  CheckCircle,
} from "lucide-react";
import PaperCard from "./PaperCard";

const statusIcons = {
  glance: Eye,
  read: BookOpen,
  study: GraduationCap,
  experiment: FlaskConical,
  done: CheckCircle,
};

const accentColors: Record<ReadingStatus, string> = {
  glance: "text-amber-600",
  read: "text-blue-600",
  study: "text-violet-600",
  experiment: "text-emerald-600",
  done: "text-zinc-500",
};

const borderColors: Record<ReadingStatus, string> = {
  glance: "border-amber-200",
  read: "border-blue-200",
  study: "border-violet-200",
  experiment: "border-emerald-200",
  done: "border-zinc-300",
};

const dotColors: Record<ReadingStatus, string> = {
  glance: "bg-amber-400",
  read: "bg-blue-400",
  study: "bg-violet-400",
  experiment: "bg-emerald-400",
  done: "bg-zinc-400",
};

const iconBg: Record<ReadingStatus, string> = {
  glance: "bg-amber-50",
  read: "bg-blue-50",
  study: "bg-violet-50",
  experiment: "bg-emerald-50",
  done: "bg-zinc-100",
};

interface StatusColumnProps {
  status: ReadingStatus;
  papers: Paper[];
  onMove: (key: string, status: ReadingStatus) => void;
  onSelect: (paper: Paper) => void;
  collectionNames: Record<string, string>;
}

export default function StatusColumn({
  status,
  papers,
  onMove,
  onSelect,
  collectionNames,
}: StatusColumnProps) {
  const Icon = statusIcons[status];
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex-1 min-w-[280px]">
      {/* Column header */}
      <div
        className={`flex items-center gap-2 mb-4 pb-3 border-b ${borderColors[status]}`}
      >
        <div className={`p-1.5 rounded-lg ${iconBg[status]} ${accentColors[status]}`}>
          <Icon size={15} />
        </div>
        <div className="flex-1">
          <h3 className={`text-base font-semibold ${accentColors[status]}`}>
            {config.label}
          </h3>
          <p className="text-xs text-zinc-400">{config.description}</p>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status]}`} />
          {papers.length}
        </span>
      </div>

      {/* Papers */}
      <div className="space-y-2.5">
        {papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`p-3 rounded-full ${iconBg[status]} mb-2 ${accentColors[status]} opacity-40`}>
              <Icon size={20} />
            </div>
            <p className="text-sm text-zinc-400">
              No papers yet
            </p>
          </div>
        ) : (
          papers.map((paper) => (
            <PaperCard
              key={paper.key}
              paper={paper}
              onMove={onMove}
              onSelect={onSelect}
              collectionNames={collectionNames}
            />
          ))
        )}
      </div>
    </div>
  );
}
