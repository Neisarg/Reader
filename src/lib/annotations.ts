export interface Highlight {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface PaperAnnotations {
  highlights: Highlight[];
  stickyNotes: StickyNote[];
}

const STORAGE_PREFIX = "reader_annotations_";

export function loadAnnotations(paperKey: string): PaperAnnotations {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + paperKey);
    if (!raw) return { highlights: [], stickyNotes: [] };
    return JSON.parse(raw);
  } catch {
    return { highlights: [], stickyNotes: [] };
  }
}

export function saveAnnotations(
  paperKey: string,
  annotations: PaperAnnotations
): void {
  localStorage.setItem(STORAGE_PREFIX + paperKey, JSON.stringify(annotations));
}

export const HIGHLIGHT_COLORS = [
  { name: "Yellow", bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", dot: "bg-yellow-400" },
  { name: "Green", bg: "bg-green-100", border: "border-green-300", text: "text-green-800", dot: "bg-green-400" },
  { name: "Blue", bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", dot: "bg-blue-400" },
  { name: "Pink", bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-800", dot: "bg-pink-400" },
  { name: "Orange", bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-400" },
];

export const STICKY_COLORS = [
  { name: "Yellow", bg: "bg-yellow-50", border: "border-yellow-200" },
  { name: "Blue", bg: "bg-blue-50", border: "border-blue-200" },
  { name: "Green", bg: "bg-green-50", border: "border-green-200" },
  { name: "Pink", bg: "bg-pink-50", border: "border-pink-200" },
];
