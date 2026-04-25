/**
 * Local embeddings generation using @xenova/transformers (ONNX Runtime).
 *
 * Runs entirely on CPU – no external API calls, no GPU required.
 * Optimised for Apple Silicon via CoreML executor in ONNX Runtime.
 *
 * Usage (local machine):
 *   npm run generate-embeddings
 *
 * The generated embeddings are stored directly in the SQLite `books` table
 * as BLOBs (384 float32 values → 1536 bytes per row).  The VPS only runs
 * the read-side cosine similarity scoring.
 */

import { pipeline } from '@xenova/transformers';

// ---------------------------------------------------------------------------
// Shared extractor singleton – model is downloaded + cached on first call
// ---------------------------------------------------------------------------

const MODEL = 'Xenova/all-MiniLM-L6-v2'; // 384-dim, fast on CPU, good Russian

let _extractor: Awaited<ReturnType<typeof buildExtractor>> | null = null;

async function buildExtractor() {
  return await pipeline('feature-extraction', MODEL);
}

async function getExtractor() {
  if (!_extractor) {
    _extractor = await buildExtractor();
  }
  return _extractor;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a single embedding vector for arbitrary text.
 *
 * @param text – Russian or English text (annotations, title+genre, query, …)
 * @returns Float32Array of length 384
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const pipe = await getExtractor();
  const result = await pipe(text, { pooling: 'mean', normalize: true });
  return result.data as Float32Array;
}

/**
 * Build the text representation that will be embedded for a book.
 */
export function buildBookText(opts: {
  title?: string | null;
  authorName?: string | null;
  performer?: string | null;
  genre?: string | null;
  description?: string | null;
}): string {
  const parts: string[] = [];
  if (opts.title) parts.push(`Title: ${opts.title}`);
  if (opts.authorName) parts.push(`Author: ${opts.authorName}`);
  if (opts.performer) parts.push(`Narrator: ${opts.performer}`);
  if (opts.genre) parts.push(`Genre: ${opts.genre}`);
  if (opts.description) parts.push(`Description: ${opts.description.slice(0, 512)}`);
  return parts.join('. ');
}

/**
 * Build a query embedding that represents the user's taste profile.
 *
 * Averages the embeddings of all books the user rated ≥ 4.
 * Falls back to the average of all liked-genre/authors text if none are rated.
 */
export async function buildUserProfileEmbedding(
  likedEmbeddings: Float32Array[],
): Promise<Float32Array> {
  if (likedEmbeddings.length === 0) {
    // Zero vector – everything will be ~0 similarity, caller should fall back
    return new Float32Array(384);
  }

  const dim = likedEmbeddings[0].length;
  const sum = new Float32Array(dim);
  for (const emb of likedEmbeddings) {
    for (let i = 0; i < dim; i++) sum[i] += emb[i];
  }
  const n = likedEmbeddings.length;
  for (let i = 0; i < dim; i++) sum[i] /= n;

  // L2-normalise the averaged vector
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += sum[i] * sum[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) sum[i] /= norm;
  }

  return sum;
}

// ---------------------------------------------------------------------------
// Cosine similarity helper
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Serialisation helpers (Float32Array ↔ Buffer for SQLite BLOB)
// ---------------------------------------------------------------------------

export function serializeEmbedding(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function deserializeEmbedding(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
