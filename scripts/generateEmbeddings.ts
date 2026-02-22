import * as dotenv from 'dotenv';

// Load environment variables immediately before anything else
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getAppDbAsync, closeDatabase } from '@/db/index';
import { book } from '@/db/schema';
import {
  initCollection as initQdrantCollection,
  upsertBooks as qdrantUpsertBooks,
  BookPoint as QdrantBookPoint,
} from '@/lib/qdrant';
import { generateEmbedding as generateOpenAIEmbedding } from '@/lib/embeddings';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function constructBookText(b: typeof book.$inferSelect): string {
  // Combine title + author + genre + performer into a single text representation
  const parts = [];
  if (b.title) parts.push(`Title: ${b.title}`);
  if (b.authorName) parts.push(`Author: ${b.authorName}`);
  if (b.genre) parts.push(`Genre: ${b.genre}`);
  if (b.performer) parts.push(`Performer: ${b.performer}`);
  if (b.description) parts.push(`Description: ${b.description.slice(0, 500)}`); // Limit description length
  return parts.join('. ');
}

async function main() {
  console.log('Starting embeddings generation...');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set. Please set it in .env');
    // Proceeding might still work if they provided OPENAI_API_KEY and changed the base URL back, but we strictly expect deepseek as per prompt.
    // We will not block it, the deepseek client will throw if it fails.
  }

  const db = await getAppDbAsync();
  console.log('Database initialized.');

  // Fetch all books
  const allBooks = await db.select().from(book).all();
  console.log(`Found ${allBooks.length} books in the database.`);

  if (allBooks.length === 0) {
    console.log('No books to process. Exiting.');
    closeDatabase();
    return;
  }

  // To determine vector size, let's generate an embedding for the first book
  console.log('Generating sample embedding to determine vector size...');
  const sampleText = constructBookText(allBooks[0]);
  const sampleEmbedding = await generateOpenAIEmbedding(sampleText);
  const vectorSize = sampleEmbedding.length;
  console.log(`Determined vector size: ${vectorSize}`);

  // Initialize Qdrant collection
  await initQdrantCollection(vectorSize);

  // Process in batches
  for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
    const batch = allBooks.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allBooks.length / BATCH_SIZE)}...`);

    const points: QdrantBookPoint[] = [];

    // Process each book in the batch
    // We use Promise.all to generate embeddings concurrently within the batch
    const batchPromises = batch.map(async (b) => {
      try {
        const textToEmbed = constructBookText(b);
        // If text is too short, we might skip, but let's embed anyway
        const vector = await generateOpenAIEmbedding(textToEmbed);
        points.push({
          id: b.id, // Ensure this maps properly. Qdrant requires UUID or integer. Assuming b.id is a string UUID.
          vector: vector,
          payload: {
            title: b.title,
            author: b.authorName,
            genre: b.genre,
          },
        });
      } catch (error: any) {
        console.error(`Failed to generate embedding for book ${b.id}:`, error.message);
      }
    });

    await Promise.all(batchPromises);

    // Upsert batch to Qdrant
    if (points.length > 0) {
      try {
        await qdrantUpsertBooks(points);
        console.log(`Successfully upserted ${points.length} points to Qdrant.`);
      } catch (error: any) {
         console.error(`Failed to upsert batch to Qdrant:`, error.message);
      }
    }

    if (i + BATCH_SIZE < allBooks.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log('Embeddings generation completed.');
  closeDatabase();
}

main().catch((error) => {
  console.error('Fatal error during embeddings generation:', error);
  closeDatabase();
  process.exit(1);
});
