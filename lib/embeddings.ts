/**
 * Generate an embedding for text using Hugging Face Inference API
 * 
 * Note: DeepSeek API does NOT currently offer embeddings (only deepseek-chat and deepseek-reasoner).
 * This uses Hugging Face's free Inference API with a multilingual model.
 * 
 * Get a free API key at: https://huggingface.co/settings/tokens
 */

// Using a model that returns embeddings (feature extraction)
const EMBEDDING_MODEL = 'microsoft/codebert-base'; // 768 dimensions

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'HUGGINGFACE_API_KEY is not configured.\n' +
      'Get a free API key at https://huggingface.co/settings/tokens\n' +
      'Note: DeepSeek does not offer embeddings API (verified - only chat models available).'
    );
  }

  // Use the Hugging Face inference endpoint
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
  }

  const embedding = await response.json();
  
  // Handle the response format - HF returns nested array [[...]]
  if (Array.isArray(embedding)) {
    // If nested array (batch response), take first
    if (Array.isArray(embedding[0])) {
      return embedding[0];
    }
    return embedding;
  }
  
  throw new Error('Unexpected embedding response format from Hugging Face');
}


