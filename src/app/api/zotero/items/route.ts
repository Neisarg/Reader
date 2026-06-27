import { NextRequest, NextResponse } from "next/server";
import { fetchAllItems, searchItems } from "@/lib/zotero";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const collection = searchParams.get("collection");
    const start = parseInt(searchParams.get("start") || "0");
    const limit = parseInt(searchParams.get("limit") || "100");

    let items;
    if (query) {
      items = await searchItems(query);
    } else {
      items = await fetchAllItems(
        collection || undefined,
        start,
        limit
      );
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("Zotero items error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
