/**
 * Generate embeddings for all books in the local SQLite database.
 *
 * Run this on your Mac (Apple Silicon / any dev machine):
 *   npm run generate-embeddings
 *
 * What it does:
 *   1. Opens the prod SQLite database at ./data/prod.db
 *   2. For each book without an embedding, builds a text representation
 *      (title + author + narrator + genre + description)
 *   3. Generates a 384-dim vector via @xenova/transformers (local ONNX)
 *   4. Stores the vector as a BLOB in the `books.embedding` column
 *
 * After completion, copy the updated prod.db to your VPS:
 *   rsync -avz ./data/prod.db user@vps:/path/to/bookAdvisor/data/
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getAppDbAsync, closeDatabase } from '../db/index';
import { book } from '../db/schema-app';
import { generateEmbedding, buildBookText, serializeEmbedding } from '../lib/embeddings-local';
import { eq, isNull } from 'drizzle-orm';

const BATCH_SIZE = 10; // smaller batches because ONNX is single-threaded

async function main() {
  console.log('=== Local Embedding Generator ===\n');

  const db = await getAppDbAsync();

  // Find books that still need an embedding
  const booksToProcess = await db
    .select()
    .from(book)
    .where(isNull(book.embedding))
    .all();

  console.log(`Found ${booksToProcess.length} books without embeddings.\n`);

  if (booksToProcess.length === 0) {
    console.log('All books already have embeddings. Nothing to do.');
    closeDatabase();
    return;
  }

  let done = 0;
  let errors = 0;

  for (let i = 0; i < booksToProcess.length; i += BATCH_SIZE) {
    const batch = booksToProcess.slice(i, i + BATCH_SIZE);

    for (const b of batch) {
      try {
        const text = buildBookText({
          title: b.title,
          authorName: b.authorName,
          performer: b.performer,
          genre: b.genre,
          description: b.description,
        });

        if (!text || text.length < 5) {
          // Skip books with too little metadata – embed a placeholder
          console.log(`  ⏭  ${b.id}: "${b.title}" – too little metadata, skipping`);
          done++;
          continue;
        }

        const vec = await generateEmbedding(text);
        const blob = serializeEmbedding(vec);

        await db
          .update(book)
          .set({ embedding: blob })
          .where(eq(book.id, b.id))
          .run();

        done++;
        process.stdout.write(`  ✓ [${done}/${booksToProcess.length}] ${b.title}\n`);
      } catch (err: any) {
        errors++;
        console.error(`  ✗ [${done + 1}] ${b.title}: ${err.message}`);
        done++;
      }
    }

    // Brief pause between batches to let the event loop breathe
    if (i + BATCH_SIZE < booksToProcess.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\nDone. ${done - errors} embedded, ${errors} failed.`);
  console.log('Now copy prod.db to your VPS:\n');
  console.log('  rsync -avz ./data/prod.db user@your-server:/path/to/bookAdvisor/data/');
  console.log();

  closeDatabase();
}

main().catch((err) => {
  console.error('Fatal:', err);
  closeDatabase();
  process.exit(1);
});
