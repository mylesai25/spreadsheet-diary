import { NextResponse } from "next/server";
import { deletePhoto, getPhoto, isClosetKind, MAX_PHOTO_BYTES, PHOTO_MIMES, putPhoto } from "@/lib/closetPhotos";
import { CORS, error, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function piece(params: Ctx["params"]) {
  const { kind, id } = await params;
  return isClosetKind(kind) && id ? { kind, id: decodeURIComponent(id) } : null;
}

/** GET /api/closet/photo/:kind/:id → the photo bytes (304 with a matching ETag). The ?v= in the closet payload changes when the photo does. */
export const GET = handler<Ctx>(async (req, { params }) => {
  const p = await piece(params);
  if (!p) return error("Unknown closet piece", 404);
  const photo = await getPhoto(p.kind, p.id);
  if (!photo) return error("No photo for this piece", 404);
  const headers = { ...CORS, "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800", ETag: photo.etag };
  if (req.headers.get("if-none-match") === photo.etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(new Uint8Array(photo.bytes), { status: 200, headers: { ...headers, "Content-Type": photo.mime, "Content-Length": String(photo.bytes.length) } });
});

/** POST /api/closet/photo/:kind/:id — body = the image bytes (Content-Type image/jpeg|png|webp) → { image } the new URL. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const p = await piece(params);
  if (!p) return error("Unknown closet piece", 404);
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!PHOTO_MIMES[mime]) return error(`Send the image bytes with Content-Type ${Object.keys(PHOTO_MIMES).join(", ")}`, 415);
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length) return error("Empty image");
  if (bytes.length > MAX_PHOTO_BYTES) return error(`Image is too large (${(bytes.length / 1048576).toFixed(1)} MB; max ${MAX_PHOTO_BYTES / 1048576} MB)`, 413);
  const image = await putPhoto(p.kind, p.id, bytes, mime);
  return json({ ok: true, image });
});

/** DELETE /api/closet/photo/:kind/:id → removes the photo and clears the sheet cell. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const p = await piece(params);
  if (!p) return error("Unknown closet piece", 404);
  await deletePhoto(p.kind, p.id);
  return json({ ok: true });
});
