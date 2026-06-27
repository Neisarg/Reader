"use client";

import { useState, useEffect, useCallback } from "react";
import { Paper, ReadingStatus, ZoteroCollection } from "./types";
import { parseItemStatus, getStatusTag } from "./zotero";

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
    .map((c) => (c.name ? c.name : `${c.firstName || ""} ${c.lastName || ""}`.trim()))
    .filter(Boolean)
    .join(", ");
}

function transformItem(item: ZoteroItemData): Paper {
  const status = parseItemStatus(item.data.tags);
  return {
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
  };
}

export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const fetchPapers = useCallback(async (collectionKey?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "100" });
      if (collectionKey) params.set("collection", collectionKey);
      const res = await fetch(`/api/zotero/items?${params}`);
      if (!res.ok) throw new Error("Failed to fetch papers");
      const items: ZoteroItemData[] = await res.json();
      setPapers(items.map(transformItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch papers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers(activeCollection);
  }, [fetchPapers, activeCollection]);

  const selectCollection = useCallback((key: string | null) => {
    setActiveCollection(key);
  }, []);

  const movePaper = useCallback(
    async (paperKey: string, newStatus: ReadingStatus) => {
      const paper = papers.find((p) => p.key === paperKey);
      if (!paper) return;

      // Optimistic update
      setPapers((prev) =>
        prev.map((p) =>
          p.key === paperKey ? { ...p, status: newStatus } : p
        )
      );

      // Build new tags: keep non-reader tags, add new reader status tag
      const nonReaderTags = paper.tags.filter(
        (t) => !t.tag.startsWith("reader/")
      );
      const newTags = [
        ...nonReaderTags,
        { tag: getStatusTag(newStatus) },
      ];

      try {
        const res = await fetch(`/api/zotero/items/${paperKey}/tags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: paper.version, tags: newTags }),
        });

        if (!res.ok) throw new Error("Failed to update tags");

        setPapers((prev) =>
          prev.map((p) =>
            p.key === paperKey
              ? { ...p, version: p.version + 1, tags: newTags }
              : p
          )
        );
      } catch {
        // Revert on failure
        setPapers((prev) =>
          prev.map((p) =>
            p.key === paperKey ? { ...p, status: paper.status } : p
          )
        );
      }
    },
    [papers]
  );

  const searchPapers = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchPapers(activeCollection);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(
        `/api/zotero/items?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Search failed");
      const items: ZoteroItemData[] = await res.json();
      setPapers(items.map(transformItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [fetchPapers, activeCollection]);

  return {
    papers,
    loading,
    error,
    movePaper,
    searchPapers,
    refetch: () => fetchPapers(activeCollection),
    activeCollection,
    selectCollection,
  };
}

export function useCollections() {
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);

  useEffect(() => {
    fetch("/api/zotero/collections")
      .then((res) => res.json())
      .then((data) =>
        setCollections(
          data
            .map(
              (c: { key: string; data: { name: string; parentCollection: string | false } }) => ({
                key: c.key,
                name: c.data.name,
                parentCollection: c.data.parentCollection,
              })
            )
            .sort((a: ZoteroCollection, b: ZoteroCollection) =>
              a.name.localeCompare(b.name)
            )
        )
      )
      .catch(() => {});
  }, []);

  return collections;
}
