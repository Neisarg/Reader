import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  let tmpPath = "";

  try {
    // Convert arxiv abstract URL to PDF URL
    let pdfUrl = url;
    if (url.includes("arxiv.org/abs/")) {
      pdfUrl = url.replace("arxiv.org/abs/", "arxiv.org/pdf/") + ".pdf";
    }

    // Download PDF
    const pdfRes = await fetch(pdfUrl, {
      headers: { "User-Agent": "Reader-App/1.0" },
    });
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    // Write to temp file
    tmpPath = join(tmpdir(), `reader_${Date.now()}.pdf`);
    await writeFile(tmpPath, buffer);

    // Extract text using pdftotext (poppler)
    const { stdout } = await execFileAsync("pdftotext", [tmpPath, "-"], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    return NextResponse.json({ text: stdout.trim() });
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract text", text: "" },
      { status: 500 }
    );
  } finally {
    if (tmpPath) {
      try { await unlink(tmpPath); } catch { /* ignore */ }
    }
  }
}
