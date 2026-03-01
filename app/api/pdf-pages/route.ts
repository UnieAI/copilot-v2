import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { name, base64 } = await req.json();

    if (!name || !base64 || !isPdf(name, "application/pdf")) {
      return NextResponse.json({ error: "Invalid PDF data" }, { status: 400 });
    }

    // Convert base64 to Uint8Array
    const binaryString = Buffer.from(base64, 'base64');
    const uint8Array = new Uint8Array(binaryString);

    // Dynamic import to avoid bundler resolving mupdf at build time
    const mupdf = await import("mupdf");

    const results = renderPagesToImages(mupdf, uint8Array);
    return NextResponse.json({ images: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[pdf-pages] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isPdf(name: string, mimeType: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ext === "pdf" || mimeType === "application/pdf";
}

function renderPagesToImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mupdf: any,
  data: Uint8Array
): { index: number; mimeType: string; base64: string }[] {
  const doc = mupdf.Document.openDocument(data, "application/pdf");
  const numPages = doc.countPages();
  const results: { index: number; mimeType: string; base64: string }[] = [];

  for (let i = 0; i < numPages; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      [2, 0, 0, 2, 0, 0], // scale 2x matrix [a,b,c,d,e,f]
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    const pngBytes: Uint8Array = pixmap.asPNG();
    results.push({
      index: i,
      mimeType: "image/png",
      base64: Buffer.from(pngBytes).toString("base64"),
    });
    pixmap.destroy();
    page.destroy();
  }

  doc.destroy();
  return results;
}