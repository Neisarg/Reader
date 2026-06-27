import { NextResponse } from "next/server";
import { fetchCollections } from "@/lib/zotero";

export async function GET() {
  try {
    const collections = await fetchCollections();
    return NextResponse.json(collections);
  } catch (error) {
    console.error("Zotero collections error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
