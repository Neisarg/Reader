import { NextRequest, NextResponse } from "next/server";

const ZOTERO_API_BASE = "https://api.zotero.org";

function getHeaders(): HeadersInit {
  return {
    "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
    "Content-Type": "application/json",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const userId = process.env.ZOTERO_USER_ID!;

    const res = await fetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${key}/children?format=json&itemType=attachment`,
      { headers: getHeaders() }
    );

    if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
    const attachments = await res.json();

    // Find PDF attachments and build download URLs
    const pdfs = attachments
      .filter(
        (a: { data: { contentType?: string; linkMode?: string } }) =>
          a.data.contentType === "application/pdf" ||
          a.data.linkMode === "linked_url"
      )
      .map((a: { key: string; data: { filename?: string; url?: string; title?: string; linkMode?: string } }) => ({
        key: a.key,
        filename: a.data.filename || a.data.title || "attachment.pdf",
        url: a.data.url,
        downloadUrl: `${ZOTERO_API_BASE}/users/${userId}/items/${a.key}/file`,
        linkMode: a.data.linkMode,
      }));

    return NextResponse.json(pdfs);
  } catch (error) {
    console.error("Attachments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get attachments" },
      { status: 500 }
    );
  }
}
