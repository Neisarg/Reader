import { NextRequest, NextResponse } from "next/server";

const ZOTERO_API_BASE = "https://api.zotero.org";

function getHeaders(): HeadersInit {
  return {
    "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
    "Content-Type": "application/json",
  };
}

// GET existing notes for an item
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const userId = process.env.ZOTERO_USER_ID!;

    const res = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${key}/children?format=json&itemType=note`,
      { headers: getHeaders() }
    );

    if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
    const notes = await res.json();

    return NextResponse.json(
      notes.map((n: { key: string; version: number; data: { note: string; tags: Array<{ tag: string }> } }) => ({
        key: n.key,
        version: n.version,
        note: n.data.note,
        tags: n.data.tags,
      }))
    );
  } catch (error) {
    console.error("Notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get notes" },
      { status: 500 }
    );
  }
}

// POST create a new note as child of item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const { content } = await request.json();
    const userId = process.env.ZOTERO_USER_ID!;

    const noteData = [
      {
        itemType: "note",
        parentItem: key,
        note: content,
        tags: [{ tag: "reader/note" }],
      },
    ];

    const res = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(noteData),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create note: ${res.status} - ${text}`);
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH update an existing note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const { noteKey, version, content } = await request.json();
    const userId = process.env.ZOTERO_USER_ID!;

    // key here is the parent item key, noteKey is the note's own key
    const res = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${noteKey}`,
      {
        method: "PATCH",
        headers: {
          ...getHeaders(),
          "If-Unmodified-Since-Version": version.toString(),
        },
        body: JSON.stringify({ note: content }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update note: ${res.status} - ${text}`);
    }

    // Suppress unused variable warning - key is used for route matching
    void key;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update note error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update note" },
      { status: 500 }
    );
  }
}
