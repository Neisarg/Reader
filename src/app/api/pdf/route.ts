import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return Response.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    // Convert arxiv abstract URL to PDF URL
    let pdfUrl = url;
    if (url.includes("arxiv.org/abs/")) {
      pdfUrl = url.replace("arxiv.org/abs/", "arxiv.org/pdf/") + ".pdf";
    }

    const res = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Reader-App/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch PDF: ${res.status}`);
    }

    const contentType = res.headers.get("content-type");
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PDF proxy error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch PDF" },
      { status: 500 }
    );
  }
}
