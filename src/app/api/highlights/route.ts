import { NextRequest, NextResponse } from "next/server";

const ZOTERO_API_BASE = "https://api.zotero.org";

function getHeaders(): HeadersInit {
  return {
    "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
    "Content-Type": "application/json",
  };
}

export async function POST(request: NextRequest) {
  try {
    const { highlights, paperKey } = await request.json();

    if (!highlights || !paperKey) {
      return NextResponse.json({ error: "highlights and paperKey required" }, { status: 400 });
    }

    const userId = process.env.ZOTERO_USER_ID!;

    // Check for existing highlights note
    const existingRes = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${paperKey}/children?format=json&itemType=note`,
      { headers: getHeaders() }
    );

    let existingNoteKey: string | null = null;
    let existingNoteVersion = 0;

    if (existingRes.ok) {
      const notes = await existingRes.json();
      const hlNote = notes.find(
        (n: { data: { tags: Array<{ tag: string }> } }) =>
          n.data.tags?.some((t: { tag: string }) => t.tag === "reader/highlights")
      );
      if (hlNote) {
        existingNoteKey = hlNote.key;
        existingNoteVersion = hlNote.version;
      }
    }

    // Build HTML — both human-readable highlights and machine-readable JSON
    const colorMap: Record<string, { name: string; border: string }> = {
      "#fef08a": { name: "Yellow", border: "#eab308" },
      "#bbf7d0": { name: "Green", border: "#22c55e" },
      "#bfdbfe": { name: "Blue", border: "#3b82f6" },
      "#fbcfe8": { name: "Pink", border: "#ec4899" },
      "#fed7aa": { name: "Orange", border: "#f97316" },
    };

    let html = `<!--READER_HIGHLIGHTS:${JSON.stringify(highlights)}-->`;
    html += "<div><h2>📌 Highlights</h2>";
    html += `<p style="color:#888;font-size:12px">${highlights.length} highlight${highlights.length !== 1 ? "s" : ""} — saved from Reader</p>`;

    for (const hl of highlights) {
      const info = colorMap[hl.color] || { name: "Yellow", border: "#eab308" };
      html += `<blockquote style="border-left:4px solid ${info.border};padding:6px 14px;margin:12px 0;background:${hl.color};border-radius:0 6px 6px 0">`;
      html += `<p style="margin:0;font-size:14px">${hl.text}</p>`;
      html += `<p style="margin:4px 0 0;font-size:11px;color:#666">Page ${hl.pageNumber} · ${info.name}</p>`;
      html += `</blockquote>`;
    }
    html += "</div>";

    if (existingNoteKey) {
      // Update existing note
      const updateRes = await fetch(
        `${ZOTERO_API_BASE}/users/${userId}/items/${existingNoteKey}`,
        {
          method: "PATCH",
          headers: {
            ...getHeaders(),
            "If-Unmodified-Since-Version": existingNoteVersion.toString(),
          },
          body: JSON.stringify({ note: html }),
        }
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`Failed to update highlights: ${updateRes.status} - ${text}`);
      }
    } else {
      // Create new note
      const createRes = await fetch(
        `${ZOTERO_API_BASE}/users/${userId}/items`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify([
            {
              itemType: "note",
              parentItem: paperKey,
              note: html,
              tags: [{ tag: "reader/highlights" }],
            },
          ]),
        }
      );
      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`Failed to create highlights: ${createRes.status} - ${text}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Highlights save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save highlights" },
      { status: 500 }
    );
  }
}

// GET: load highlights from Zotero
export async function GET(request: NextRequest) {
  try {
    const paperKey = request.nextUrl.searchParams.get("paperKey");
    if (!paperKey) {
      return NextResponse.json({ error: "paperKey required" }, { status: 400 });
    }

    const userId = process.env.ZOTERO_USER_ID!;

    const res = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${paperKey}/children?format=json&itemType=note`,
      { headers: getHeaders() }
    );

    if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
    const notes = await res.json();

    const hlNote = notes.find(
      (n: { data: { tags: Array<{ tag: string }> } }) =>
        n.data.tags?.some((t: { tag: string }) => t.tag === "reader/highlights")
    );

    if (hlNote) {
      const match = hlNote.data.note.match(/<!--READER_HIGHLIGHTS:(.*?)-->/);
      if (match) {
        return NextResponse.json({ highlights: JSON.parse(match[1]) });
      }
    }

    return NextResponse.json({ highlights: [] });
  } catch (error) {
    console.error("Highlights load error:", error);
    return NextResponse.json({ highlights: [] });
  }
}
