import { NextRequest, NextResponse } from "next/server";
import { updateItemTags } from "@/lib/zotero";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const body = await request.json();
    const { version, tags } = body;

    if (!version || !tags) {
      return NextResponse.json(
        { error: "version and tags are required" },
        { status: 400 }
      );
    }

    await updateItemTags(key, version, tags);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update tags error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
