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
      `${ZOTERO_API_BASE}/users/${userId}/items/${key}?format=json`,
      { headers: getHeaders() }
    );

    if (!res.ok) throw new Error(`Zotero API error: ${res.status}`);
    const item = await res.json();
    return NextResponse.json(item);
  } catch (error) {
    console.error("Fetch item error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch item" },
      { status: 500 }
    );
  }
}
