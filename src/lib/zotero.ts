const ZOTERO_API_BASE = "https://api.zotero.org";

function getHeaders(): HeadersInit {
  const apiKey = process.env.ZOTERO_API_KEY;
  if (!apiKey) throw new Error("ZOTERO_API_KEY not set");
  return {
    "Zotero-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

function getUserId(): string {
  const userId = process.env.ZOTERO_USER_ID;
  if (!userId) throw new Error("ZOTERO_USER_ID not set");
  return userId;
}

function userBase(): string {
  return `${ZOTERO_API_BASE}/users/${getUserId()}`;
}

export interface ZoteroItem {
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

export interface ZoteroCollection {
  key: string;
  version: number;
  data: {
    key: string;
    name: string;
    parentCollection: string | false;
  };
}

export const READING_TAGS = {
  STATUS_GLANCE: "reader/glance",
  STATUS_READ: "reader/read",
  STATUS_STUDY: "reader/study",
  STATUS_EXPERIMENT: "reader/experiment",
  STATUS_DONE: "reader/done",
} as const;

export type ReadingStatus = "glance" | "read" | "study" | "experiment" | "done";

export function getStatusTag(status: ReadingStatus): string {
  return `reader/${status}`;
}

export function parseItemStatus(tags: Array<{ tag: string }>): ReadingStatus {
  for (const { tag } of tags) {
    if (tag === READING_TAGS.STATUS_DONE) return "done";
    if (tag === READING_TAGS.STATUS_READ) return "read";
    if (tag === READING_TAGS.STATUS_STUDY) return "study";
    if (tag === READING_TAGS.STATUS_EXPERIMENT) return "experiment";
  }
  return "glance";
}

export async function fetchAllItems(
  collectionKey?: string,
  start = 0,
  limit = 100
): Promise<ZoteroItem[]> {
  const params = new URLSearchParams({
    format: "json",
    start: start.toString(),
    limit: limit.toString(),
    sort: "dateModified",
    direction: "desc",
    itemType: "-attachment || note",
  });

  const path = collectionKey
    ? `${userBase()}/collections/${collectionKey}/items/top`
    : `${userBase()}/items/top`;

  const res = await fetch(`${path}?${params}`, {
    headers: getHeaders(),
    next: { revalidate: 30 },
  });

  if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
  return res.json();
}

export async function fetchCollections(): Promise<ZoteroCollection[]> {
  const res = await fetch(`${userBase()}/collections?format=json&limit=100`, {
    headers: getHeaders(),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
  return res.json();
}

export async function updateItemTags(
  itemKey: string,
  currentVersion: number,
  tags: Array<{ tag: string; type?: number }>
): Promise<void> {
  const res = await fetch(`${userBase()}/items/${itemKey}`, {
    method: "PATCH",
    headers: {
      ...getHeaders(),
      "If-Unmodified-Since-Version": currentVersion.toString(),
    },
    body: JSON.stringify({ tags }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update tags: ${res.status} - ${text}`);
  }
}

export async function searchItems(query: string): Promise<ZoteroItem[]> {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    limit: "50",
    itemType: "-attachment || note",
  });

  const res = await fetch(`${userBase()}/items/top?${params}`, {
    headers: getHeaders(),
  });

  if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
  return res.json();
}
