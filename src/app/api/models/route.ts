import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not set" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/models?limit=50", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const data = await res.json();

    // Filter to chat-capable models and sort by creation date (newest first)
    const models = data.data
      .filter((m: { id: string }) => {
        // Only include claude models, skip embedding/legacy models
        return m.id.startsWith("claude-");
      })
      .map(
        (m: {
          id: string;
          display_name: string;
          created_at: string;
          max_tokens: number;
        }) => ({
          id: m.id,
          name: m.display_name,
          createdAt: m.created_at,
          maxTokens: m.max_tokens,
        })
      )
      .sort(
        (
          a: { createdAt: string },
          b: { createdAt: string }
        ) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json(models);
  } catch (error) {
    console.error("Models error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}
