import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "highlights");

function filePath(paperKey: string): string {
  // Sanitise key to prevent path traversal
  const safe = paperKey.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(DATA_DIR, `${safe}.json`);
}

// POST: save highlights to a local JSON file (no Zotero)
export async function POST(request: NextRequest) {
  try {
    const { highlights, paperKey } = await request.json();

    if (!highlights || !paperKey) {
      return NextResponse.json(
        { error: "highlights and paperKey required" },
        { status: 400 },
      );
    }

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(filePath(paperKey), JSON.stringify(highlights, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Highlights save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 },
    );
  }
}

// GET: load highlights from local JSON file, fallback to Zotero for migration
export async function GET(request: NextRequest) {
  try {
    const paperKey = request.nextUrl.searchParams.get("paperKey");
    if (!paperKey) {
      return NextResponse.json({ error: "paperKey required" }, { status: 400 });
    }

    // Try local file first
    try {
      const raw = await readFile(filePath(paperKey), "utf-8");
      const highlights = JSON.parse(raw);
      if (Array.isArray(highlights) && highlights.length > 0) {
        return NextResponse.json({ highlights });
      }
    } catch {
      /* file doesn't exist yet — fall through to Zotero migration */
    }

    // Fallback: migrate from Zotero note (one-time)
    const userId = process.env.ZOTERO_USER_ID;
    const apiKey = process.env.ZOTERO_API_KEY;
    if (userId && apiKey) {
      try {
        const res = await fetch(
          `https://api.zotero.org/users/${userId}/items/${paperKey}/children?format=json&itemType=note`,
          {
            headers: {
              "Zotero-API-Key": apiKey,
              "Content-Type": "application/json",
            },
          },
        );
        if (res.ok) {
          const notes = await res.json();
          const hlNote = notes.find(
            (n: { data: { tags: Array<{ tag: string }> } }) =>
              n.data.tags?.some(
                (t: { tag: string }) => t.tag === "reader/highlights",
              ),
          );
          if (hlNote) {
            const match = hlNote.data.note.match(
              /<!--READER_HIGHLIGHTS:(.*?)-->/,
            );
            if (match) {
              const highlights = JSON.parse(match[1]);
              // Persist locally so we don't hit Zotero again
              await mkdir(DATA_DIR, { recursive: true });
              await writeFile(
                filePath(paperKey),
                JSON.stringify(highlights, null, 2),
              );
              return NextResponse.json({ highlights });
            }
          }
        }
      } catch {
        /* Zotero unreachable — fine */
      }
    }

    return NextResponse.json({ highlights: [] });
  } catch (error) {
    console.error("Highlights load error:", error);
    return NextResponse.json({ highlights: [] });
  }
}
