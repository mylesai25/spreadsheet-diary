import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getStore } from "./store";
import { CLOSET } from "./schema/closet";
import type { ClosetKind } from "./schema/types";

/** Photos of the Virtual Closet pieces.
 *
 *  The sheet stays the source of truth: each closet tab gets a "<Kind> Image" column (created on the first upload)
 *  holding a reference to the photo. In Sheets mode the file lives in an S3 bucket (S3_BUCKET + AWS_REGION, credentials
 *  from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) and the cell holds `s3://bucket/key`. In CSV mode the file sits under
 *  data/closet/photos/ and the cell holds its relative path. Clients never see the storage — they get
 *  /api/closet/photo/<kind>/<id>?v=…, which streams the bytes through the app's own auth. */

export const PHOTO_MIMES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface Photo { bytes: Buffer; mime: string; etag: string; }

type Ref = { kind: "s3"; bucket: string; key: string } | { kind: "file"; rel: string };

export function isClosetKind(k: string): k is ClosetKind { return k in CLOSET; }

/** Short version tag so clients can cache a photo URL and still see a replacement. */
export function photoVersion(cell: string): string {
  return createHash("sha1").update(cell).digest("hex").slice(0, 8);
}

/** The client-facing URL for a piece's photo, or undefined when the cell is blank. */
export function photoUrl(kind: ClosetKind, id: string, cell: string | undefined): string | undefined {
  const v = (cell ?? "").trim();
  return v ? `/api/closet/photo/${kind}/${encodeURIComponent(id)}?v=${photoVersion(v)}` : undefined;
}

function parseRef(cell: string): Ref | null {
  const v = cell.trim();
  if (!v) return null;
  const m = v.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (m) return { kind: "s3", bucket: m[1], key: m[2] };
  if (/^https?:\/\//.test(v)) return null;   // a link from elsewhere (e.g. an old Drive URL) — not something we can stream
  return { kind: "file", rel: v.replace(/^\/+/, "") };
}

const LOCAL_ROOT = path.join(process.cwd(), "data", "closet");
const localPath = (rel: string) => {
  const p = path.normalize(path.join(LOCAL_ROOT, rel));
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Bad photo path");
  return p;
};

/** Locate a piece: its sheet row number and the current photo cell. */
async function locate(kind: ClosetKind, id: string) {
  const cfg = CLOSET[kind];
  const data = await getStore().read("closet", cfg.sheet);
  const idCol = data.header.indexOf(cfg.idCol), imgCol = data.header.indexOf(cfg.imageCol);
  if (idCol < 0) throw new Error(`${cfg.sheet} sheet has no ${cfg.idCol} column`);
  const idx = data.rows.findIndex((r) => r[idCol].trim() === id);
  if (idx < 0) return null;
  return { cfg, rowNumber: idx + 2, cell: imgCol >= 0 ? data.rows[idx][imgCol] : "" };
}

// ── S3 ──
declare global { var __diaryS3: S3Client | undefined; }

function s3() {
  if (!globalThis.__diaryS3) globalThis.__diaryS3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  return globalThis.__diaryS3;
}

function bucket(): string {
  const b = process.env.S3_BUCKET?.trim();
  if (!b) throw new Error("Closet photos need an S3 bucket: set S3_BUCKET (and AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) — see scripts/setup-s3.sh");
  return b;
}

const keyPrefix = () => (process.env.S3_PREFIX ?? "closet/").replace(/^\/+/, "");

async function s3Upload(name: string, bytes: Buffer, mime: string): Promise<{ bucket: string; key: string }> {
  const ref = { bucket: bucket(), key: keyPrefix() + name };
  await s3().send(new PutObjectCommand({ Bucket: ref.bucket, Key: ref.key, Body: bytes, ContentType: mime, CacheControl: "private, max-age=31536000, immutable" }));
  return ref;
}

async function s3Download(ref: { bucket: string; key: string }): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    const bytes = Buffer.from(await res.Body!.transformToByteArray());
    return { bytes, mime: res.ContentType ?? "image/jpeg" };
  } catch (e) {
    if (e instanceof S3ServiceException && (e.name === "NoSuchKey" || e.$metadata.httpStatusCode === 404)) return null;
    throw e;
  }
}

async function removeRef(ref: Ref | null) {
  if (!ref) return;
  try {
    if (ref.kind === "s3") await s3().send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    else await fs.unlink(localPath(ref.rel));
  } catch { /* already gone */ }
}

// ── Public API ──

/** The photo bytes for a piece, null when it has none (or the piece doesn't exist). */
export async function getPhoto(kind: ClosetKind, id: string): Promise<Photo | null> {
  const loc = await locate(kind, id);
  const ref = loc ? parseRef(loc.cell) : null;
  if (!loc || !ref) return null;
  const etag = `"${photoVersion(loc.cell.trim())}"`;
  if (ref.kind === "file") {
    try {
      const bytes = await fs.readFile(localPath(ref.rel));
      const ext = path.extname(ref.rel).slice(1).toLowerCase();
      const mime = Object.entries(PHOTO_MIMES).find(([, e]) => e === ext || (e === "jpg" && ext === "jpeg"))?.[0] ?? "image/jpeg";
      return { bytes, mime, etag };
    } catch { return null; }
  }
  const got = await s3Download(ref);
  return got ? { ...got, etag } : null;
}

/** Attach (or replace) a piece's photo. Returns the new client URL. */
export async function putPhoto(kind: ClosetKind, id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = PHOTO_MIMES[mime];
  if (!ext) throw new Error(`Unsupported image type ${mime}`);
  const loc = await locate(kind, id);
  if (!loc) throw new Error(`No ${kind} #${id} in the closet`);
  const store = getStore();
  const stamp = Date.now().toString(36);
  const name = `${kind}-${id}-${stamp}.${ext}`;
  let cell: string;
  if (store.kind === "sheets") {
    const ref = await s3Upload(name, bytes, mime);
    cell = `s3://${ref.bucket}/${ref.key}`;
  } else {
    const rel = path.posix.join("photos", name);
    await fs.mkdir(path.dirname(localPath(rel)), { recursive: true });
    await fs.writeFile(localPath(rel), bytes);
    cell = rel;
  }
  await store.ensureColumns("closet", loc.cfg.sheet, [loc.cfg.imageCol]);
  await store.updateCells("closet", loc.cfg.sheet, loc.rowNumber, { [loc.cfg.imageCol]: cell });
  await removeRef(parseRef(loc.cell));   // the previous photo, once the sheet points at the new one
  return photoUrl(kind, id, cell)!;
}

/** Detach a piece's photo (clears the cell and deletes the file). */
export async function deletePhoto(kind: ClosetKind, id: string): Promise<void> {
  const loc = await locate(kind, id);
  if (!loc) throw new Error(`No ${kind} #${id} in the closet`);
  const ref = parseRef(loc.cell);
  if (!ref) return;
  await getStore().updateCells("closet", loc.cfg.sheet, loc.rowNumber, { [loc.cfg.imageCol]: "" });
  await removeRef(ref);
}
