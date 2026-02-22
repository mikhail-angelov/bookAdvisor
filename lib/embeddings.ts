import OpenAI from 'openai';

// We initialize openai instance dynamically in the function to ensure process.env is read after dotenv config if needed,
// but OpenAI client allows just passing the key.

/**
 * Generate an embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured in environment variables');
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  // Note: deepseek might have a specific model name for embeddings or use a standard one.
  // standard deepseek embeddings model (replace if deepseek requires another name)
  const response = await openai.embeddings.create({
    model: 'deepseek-embedding-v2',
    input: text,
  });

  return response.data[0].embedding;
}
