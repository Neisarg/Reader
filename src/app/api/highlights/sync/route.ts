import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { execFileSync } from "child_process";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFHexString,
  PDFRawStream,
} from "pdf-lib";

const ZOTERO_API_BASE = "https://api.zotero.org";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HighlightData {
  id: string;
  pageNumber: number;
  color: string;
  text: string;
  rects: HighlightRect[];
}

// ---------------------------------------------------------------------------
// PDF annotation embedding (same logic as /api/pdf)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 1, g: 1, b: 0 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
}

const HL_OPACITY = 0.35;

async function embedHighlightsInPdf(
  pdfBytes: Uint8Array,
  highlights: HighlightData[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const hl of highlights) {
    const page = pages[hl.pageNumber - 1];
    if (!page) continue;

    const pw = page.getWidth();
    const ph = page.getHeight();
    const color = hexToRgb(hl.color);

    const pdfRects: { x: number; y: number; w: number; h: number }[] = [];
    const quadPoints: number[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const r of hl.rects) {
      const x = (r.x / 100) * pw;
      const w = (r.width / 100) * pw;
      const h = (r.height / 100) * ph;
      const y = ph - (r.y / 100) * ph - h;

      pdfRects.push({ x, y, w, h });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);

      quadPoints.push(x, y + h, x + w, y + h, x, y, x + w, y);
    }

    const apW = maxX - minX;
    const apH = maxY - minY;

    let drawOps = "";
    for (const r of pdfRects) {
      drawOps += `${(r.x - minX).toFixed(2)} ${(r.y - minY).toFixed(2)} ${r.w.toFixed(2)} ${r.h.toFixed(2)} re\n`;
    }

    const stream = [
      "q",
      "/GS1 gs",
      `${color.r.toFixed(4)} ${color.g.toFixed(4)} ${color.b.toFixed(4)} rg`,
      drawOps.trimEnd(),
      "f",
      "Q",
    ].join("\n");

    const gsRef = pdfDoc.context.register(
      pdfDoc.context.obj({ Type: "ExtGState", ca: HL_OPACITY, BM: "Multiply" }),
    );
    const formDict = pdfDoc.context.obj({
      Type: "XObject",
      Subtype: "Form",
      FormType: 1,
      BBox: [0, 0, apW, apH],
      Resources: { ExtGState: { GS1: gsRef } },
    });
    const apRef = pdfDoc.context.register(
      PDFRawStream.of(formDict as any, new TextEncoder().encode(stream)),
    );

    const annotRef = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Highlight",
        Rect: [minX, minY, maxX, maxY],
        QuadPoints: quadPoints,
        C: [color.r, color.g, color.b],
        CA: HL_OPACITY,
        F: 4,
        T: PDFHexString.fromText("Reader"),
        Contents: PDFHexString.fromText(hl.text || ""),
        AP: { N: apRef },
      }),
    );

    try {
      const existing = page.node.get(PDFName.of("Annots"));
      if (existing) {
        page.node.lookup(PDFName.of("Annots"), PDFArray).push(annotRef);
      } else {
        page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
      }
    } catch {
      page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
    }
  }

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Zotero file upload helpers
// ---------------------------------------------------------------------------

function zoteroHeaders(): HeadersInit {
  return {
    "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
    "Content-Type": "application/json",
  };
}

interface ZoteroAttachment {
  key: string;
  data: {
    filename: string;
    contentType: string;
    linkMode: string;
    md5: string;
    [k: string]: unknown;
  };
}

async function findStoredPdfAttachment(
  userId: string,
  paperKey: string,
): Promise<ZoteroAttachment | null> {
  const res = await fetch(
    `${ZOTERO_API_BASE}/users/${userId}/items/${paperKey}/children?format=json&itemType=attachment`,
    { headers: zoteroHeaders() },
  );
  if (!res.ok) return null;

  const attachments: ZoteroAttachment[] = await res.json();
  return (
    attachments.find(
      (a) =>
        a.data.contentType === "application/pdf" &&
        (a.data.linkMode === "imported_file" ||
          a.data.linkMode === "imported_url"),
    ) ?? null
  );
}

async function createAttachmentItem(
  userId: string,
  paperKey: string,
  filename: string,
  sourceUrl: string,
): Promise<string> {
  const res = await fetch(`${ZOTERO_API_BASE}/users/${userId}/items`, {
    method: "POST",
    headers: zoteroHeaders(),
    body: JSON.stringify([
      {
        itemType: "attachment",
        parentItem: paperKey,
        linkMode: "imported_url",
        title: filename,
        contentType: "application/pdf",
        filename,
        url: sourceUrl,
        tags: [{ tag: "reader/annotated" }],
      },
    ]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create attachment: ${res.status} – ${text}`);
  }

  const result = await res.json();
  const keys = Object.keys(result.successful || {});
  if (keys.length === 0) throw new Error("No item key returned");
  return result.successful[keys[0]].key;
}

async function uploadFileToZotero(
  userId: string,
  attachmentKey: string,
  fileBytes: Uint8Array,
  filename: string,
  existingMd5?: string,
): Promise<void> {
  const newMd5 = createHash("md5").update(fileBytes).digest("hex");
  console.log("[sync] Upload: md5=", newMd5, "size=", fileBytes.byteLength, "existing=", existingMd5);

  // Step 1: get upload authorization
  const authRes = await fetch(
    `${ZOTERO_API_BASE}/users/${userId}/items/${attachmentKey}/file`,
    {
      method: "POST",
      headers: {
        "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(existingMd5
          ? { "If-Match": existingMd5 }
          : { "If-None-Match": "*" }),
      },
      body: new URLSearchParams({
        md5: newMd5,
        filename,
        filesize: fileBytes.byteLength.toString(),
        mtime: Date.now().toString(),
      }).toString(),
    },
  );

  if (!authRes.ok) {
    const text = await authRes.text();
    throw new Error(`Upload auth failed: ${authRes.status} – ${text}`);
  }

  const auth = await authRes.json();
  console.log("[sync] Auth response:", auth.exists ? "EXISTS" : "NEED_UPLOAD", "uploadKey:", auth.uploadKey?.slice(0, 10));
  if (auth.exists) return; // same file already stored

  // Step 2: upload to S3 via curl (bypasses Next.js/Turbopack fetch/https issues)
  const { url, contentType, prefix, suffix, uploadKey } = auth;
  const uploadBody = Buffer.concat([
    Buffer.from(prefix, "utf-8"),
    Buffer.from(fileBytes),
    Buffer.from(suffix, "utf-8"),
  ]);
  console.log("[sync] Uploading", uploadBody.byteLength, "bytes to S3");

  const { writeFileSync, unlinkSync } = await import("fs");
  const tmpPath = join(process.cwd(), "data", `_upload_${Date.now()}.tmp`);
  try {
    writeFileSync(tmpPath, uploadBody);
    execFileSync("curl", [
      "-s", "-f",
      "-X", "POST",
      "-H", `Content-Type: ${contentType}`,
      "--data-binary", `@${tmpPath}`,
      url,
    ], { timeout: 120_000 });
    console.log("[sync] S3 upload complete");
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  // Step 3: register upload
  const registerRes = await fetch(
    `${ZOTERO_API_BASE}/users/${userId}/items/${attachmentKey}/file`,
    {
      method: "POST",
      headers: {
        "Zotero-API-Key": process.env.ZOTERO_API_KEY!,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(existingMd5
          ? { "If-Match": existingMd5 }
          : { "If-None-Match": "*" }),
      },
      body: new URLSearchParams({ upload: uploadKey }).toString(),
    },
  );
  if (!registerRes.ok) {
    const text = await registerRes.text();
    throw new Error(`Upload registration failed: ${registerRes.status} – ${text}`);
  }
}

// ---------------------------------------------------------------------------
// POST handler — embed highlights in PDF and upload to Zotero
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { pdfUrl, highlights, paperKey } = await request.json();

    if (!pdfUrl || !highlights?.length || !paperKey) {
      return NextResponse.json(
        { error: "pdfUrl, highlights, and paperKey required" },
        { status: 400 },
      );
    }

    const userId = process.env.ZOTERO_USER_ID!;

    // 1. Fetch original PDF
    let fetchUrl = pdfUrl;
    if (pdfUrl.includes("/api/pdf")) {
      try {
        fetchUrl =
          new URL(pdfUrl, "http://localhost").searchParams.get("url") || pdfUrl;
      } catch { /* use as-is */ }
    }
    if (fetchUrl.includes("arxiv.org/abs/")) {
      fetchUrl = fetchUrl.replace("arxiv.org/abs/", "arxiv.org/pdf/") + ".pdf";
    }

    console.log("[sync] Fetching PDF from:", fetchUrl);
    const pdfRes = await fetch(fetchUrl, {
      headers: { "User-Agent": "Reader-App/1.0" },
    });
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
    const originalPdf = new Uint8Array(await pdfRes.arrayBuffer());
    console.log("[sync] PDF fetched:", originalPdf.length, "bytes");

    // 2. Embed highlights
    const annotatedPdf = await embedHighlightsInPdf(originalPdf, highlights);
    console.log("[sync] Highlights embedded:", highlights.length, "annotations,", annotatedPdf.length, "bytes");

    // 3. Find or create a stored attachment in Zotero
    const existing = await findStoredPdfAttachment(userId, paperKey);
    console.log("[sync] Existing attachment:", existing?.key || "NONE");

    let attachmentKey: string;
    let existingMd5: string | undefined;
    let filename: string;

    if (existing) {
      attachmentKey = existing.key;
      existingMd5 = existing.data.md5;
      filename = existing.data.filename || "document.pdf";
    } else {
      const urlParts = fetchUrl.split("/");
      filename =
        urlParts[urlParts.length - 1]?.replace(/[^a-zA-Z0-9._-]/g, "") ||
        "paper";
      if (!filename.endsWith(".pdf")) filename += ".pdf";

      attachmentKey = await createAttachmentItem(
        userId,
        paperKey,
        filename,
        fetchUrl,
      );
    }

    // 4. Upload annotated PDF to Zotero
    await uploadFileToZotero(
      userId,
      attachmentKey,
      annotatedPdf,
      filename,
      existingMd5,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Highlights sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync highlights to Zotero",
      },
      { status: 500 },
    );
  }
}
