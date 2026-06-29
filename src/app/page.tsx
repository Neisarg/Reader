"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePapers, useCollections } from "@/lib/hooks";
import { Paper, ReadingStatus } from "@/lib/types";
import StatusColumn from "@/components/StatusColumn";
import {
  Search,
  RefreshCw,
  BookOpenCheck,
  Loader2,
  AlertCircle,
  X,
  Library,
  FolderOpen,
  CheckCircle,
} from "lucide-react";

export default function Home() {
  const {
    papers,
    loading,
    error,
    movePaper,
    searchPapers,
    refetch,
    activeCollection,
    selectCollection,
  } = usePapers();
  const collections = useCollections();

  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [showDone, setShowDone] = useState(false);

  const collectionNames = useMemo(() => {
    const map: Record<string, string> = {};
    collections.forEach((c) => (map[c.key] = c.name));
    return map;
  }, [collections]);

  const activeStatuses: ReadingStatus[] = ["glance", "read", "study", "experiment"];

  const papersByStatus = useMemo(() => {
    const all: ReadingStatus[] = ["glance", "read", "study", "experiment", "done"];
    return all.reduce(
      (acc, status) => {
        acc[status] = papers.filter((p) => p.status === status);
        return acc;
      },
      {} as Record<ReadingStatus, Paper[]>
    );
  }, [papers]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      searchPapers(searchQuery);
    },
    [searchQuery, searchPapers]
  );

  const handleMove = useCallback(
    (key: string, status: ReadingStatus) => {
      movePaper(key, status);
    },
    [movePaper]
  );

  const handleSelect = useCallback(
    (paper: Paper) => {
      router.push(`/paper/${paper.key}`);
    },
    [router]
  );

  const doneCount = papersByStatus.done?.length ?? 0;
  const activeCount = papers.length - doneCount;

  const stats = useMemo(() => {
    return {
      glance: papersByStatus.glance?.length ?? 0,
      read: papersByStatus.read?.length ?? 0,
      study: papersByStatus.study?.length ?? 0,
      experiment: papersByStatus.experiment?.length ?? 0,
    };
  }, [papersByStatus]);

  const activeCollectionName = activeCollection
    ? collectionNames[activeCollection] || "Collection"
    : "All Papers";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — Collection list */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-zinc-200 flex flex-col h-screen sticky top-0">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200">
              <BookOpenCheck size={18} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-800 tracking-tight">
                Reader
              </h1>
              <p className="text-xs text-zinc-400">
                Research Paper Manager
              </p>
            </div>
          </div>
        </div>

        {/* Collections */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <p className="px-2 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Collections
          </p>

          {/* All papers */}
          <button
            onClick={() => selectCollection(null)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors mb-0.5
              ${!activeCollection
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
          >
            <Library size={14} className={!activeCollection ? "text-indigo-500" : "text-zinc-400"} />
            All Papers
          </button>

          {/* Collection list */}
          <div className="space-y-0.5">
            {collections.map((c) => (
              <button
                key={c.key}
                onClick={() => selectCollection(c.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left
                  ${activeCollection === c.key
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
              >
                <FolderOpen
                  size={13}
                  className={activeCollection === c.key ? "text-indigo-500" : "text-zinc-400"}
                />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar footer stats */}
        <div className="px-4 py-3 border-t border-zinc-100">
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-center">
              {stats.glance} glance
            </span>
            <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-center">
              {stats.read} read
            </span>
            <span className="text-violet-700 bg-violet-50 px-2 py-1 rounded text-center">
              {stats.study} study
            </span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-center">
              {stats.experiment} experiment
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-zinc-50/80 backdrop-blur-xl border-b border-zinc-200">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-800">
                {showDone ? "Done" : activeCollectionName}
              </h2>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                {showDone ? doneCount : activeCount} paper{(showDone ? doneCount : activeCount) !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Done toggle */}
              <button
                onClick={() => setShowDone(!showDone)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${showDone
                    ? "bg-zinc-200 text-zinc-700 border-zinc-300"
                    : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600 hover:bg-zinc-50"
                  }`}
              >
                <CheckCircle size={15} />
                Done
                {doneCount > 0 && (
                  <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                    showDone ? "bg-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {doneCount}
                  </span>
                )}
              </button>

              <form onSubmit={handleSearch} className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers..."
                  className="w-48 lg:w-64 bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2
                           text-sm text-zinc-700 placeholder:text-zinc-400
                           focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200
                           transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchPapers("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </form>

              <button
                onClick={refetch}
                disabled={loading}
                className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-400
                         hover:text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </header>

        {/* Board */}
        <main className="flex-1 px-6 py-6">
          {loading && papers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 size={32} className="text-indigo-500 animate-spin mb-4" />
              <p className="text-sm text-zinc-400">Syncing with Zotero...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">
                  Failed to connect to Zotero
                </p>
                <p className="text-xs text-red-500 mt-0.5">{error}</p>
              </div>
              <button
                onClick={refetch}
                className="ml-auto text-xs text-red-600 hover:text-red-700 bg-red-100 px-3 py-1.5 rounded-lg"
              >
                Retry
              </button>
            </div>
          )}

          {(!loading || papers.length > 0) && !showDone && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {activeStatuses.map((status) => (
                <StatusColumn
                  key={status}
                  status={status}
                  papers={papersByStatus[status] || []}
                  onMove={handleMove}
                  onSelect={handleSelect}
                  collectionNames={collectionNames}
                />
              ))}
            </div>
          )}

          {(!loading || papers.length > 0) && showDone && (
            <div className="max-w-2xl">
              <StatusColumn
                status="done"
                papers={papersByStatus.done || []}
                onMove={handleMove}
                onSelect={handleSelect}
                collectionNames={collectionNames}
              />
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
