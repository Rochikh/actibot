import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

// ID de l'assistant créé
let ASSISTANT_ID: string | null = null;

async function getOrCreateAssistant() {
  if (ASSISTANT_ID) {
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      return assistant;
    } catch (error) {
      console.warn('Failed to retrieve assistant, creating new one:', error);
    }
  }

  const assistant = await openai.beta.assistants.create({
    name: "ActiBot",
    instructions: `Tu es ActiBot, un assistant spécialisé dans les outils d'IA.

1. Tu t'appuies uniquement sur le contexte fourni pour répondre aux questions.
2. Tu es expert en outils d'IA (générateurs d'images, chatbots, etc).
3. Pour chaque outil mentionné, tu précises :
   - Son nom et sa fonction principale
   - Ses points forts et limitations
   - Si une version gratuite existe
4. Si une information n'est pas dans le contexte, tu le dis clairement.
5. Format des réponses :
   - Vue d'ensemble des outils pertinents
   - Détails spécifiques pour chaque outil
   - Citations entre guillemets du contexte
   - Mention explicite des informations manquantes`,
    model: "gpt-4-turbo-preview"
  });

  ASSISTANT_ID = assistant.id;
  return assistant;
}

async function waitForRunCompletion(threadId: string, runId: string) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);

      if (run.status === 'completed') {
        return run;
      }

      if (run.status === 'failed' || run.status === 'cancelled') {
        throw new Error(`Run ended with status: ${run.status}`);
      }

      // Add delay before next check
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      retries++;
    } catch (error) {
      if (retries === MAX_RETRIES - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      retries++;
    }
  }
  throw new Error('Run timed out');
}

// Generates embeddings for semantic search
export async function generateEmbedding(text: string): Promise<number[]> {
  const enhancedQuery = `outils intelligence artificielle IA ${text} generateur creation image Midjourney Dall-E Stable Diffusion chatbot assistant`;

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: enhancedQuery,
    encoding_format: "float"
  });

  return response.data[0].embedding;
}

// Main chat function using Assistants API
export async function getChatResponse(
  question: string,
  history: any[] = []
) {
  try {
    console.log('Processing chat request:', { question, historyLength: history.length });

    const assistant = await getOrCreateAssistant();
    const thread = await openai.beta.threads.create();

    // Add previous messages from history if any
    if (history.length > 0) {
      for (const msg of history.slice(-3)) {
        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: msg.message
        });
        if (msg.response) {
          await openai.beta.threads.messages.create(thread.id, {
            role: "assistant",
            content: msg.response
          });
        }
      }
    }

    // Add the new question
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question
    });

    // Create and monitor the run
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });

    await waitForRunCompletion(thread.id, run.id);

    // Get the latest message
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    if (!lastMessage || lastMessage.role !== 'assistant') {
      throw new Error('Invalid response from assistant');
    }

    const content = lastMessage.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from assistant');
    }

    return content.text.value;

  } catch (error) {
    console.error('Error in chat response:', error);
    throw new Error('Une erreur est survenue lors de la génération de la réponse. Veuillez réessayer.');
  }
}

// Recherche de documents similaires avec seuil plus bas et plus de logging
export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  try {
    console.log('Processing search query:', query);
    const queryEmbedding = await generateEmbedding(query);

    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Using cosine_similarity instead of <=> operator for better compatibility
    const result = await db.execute(sql`
      WITH similarity_chunks AS (
        SELECT 
          dc.content,
          d.title as document_title,
          cosine_similarity(dc.embedding, ${embeddingString}::vector(1536)) as similarity,
          dc.metadata,
          d.id as document_id,
          ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY cosine_similarity(dc.embedding, ${embeddingString}::vector(1536)) DESC
          ) as chunk_rank,
          COUNT(*) OVER (PARTITION BY d.id) as total_chunks
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.content IS NOT NULL AND LENGTH(dc.content) > 0
      )
      SELECT 
        content,
        document_title,
        document_id,
        similarity::float4,
        metadata,
        chunk_rank,
        total_chunks
      FROM similarity_chunks
      WHERE 
        chunk_rank <= 15 AND
        similarity > 0.7
      ORDER BY similarity DESC, document_id, chunk_rank
      LIMIT 150;
    `);

    const chunks = result.rows.map(row => ({
      ...row,
      content: row.content || '',
      similarity: Number(row.similarity) || 0,
      document_title: row.document_title || 'Untitled',
      chunk_rank: Number(row.chunk_rank) || 1,
      total_chunks: Number(row.total_chunks) || 1
    }));

    // Log detailed information about found chunks
    console.log(`Found ${chunks.length} relevant chunks across ${new Set(chunks.map(c => c.document_id)).size} documents`);
    chunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(`- Document: ${chunk.document_title}`);
      console.log(`- Similarity: ${(chunk.similarity * 100).toFixed(2)}%`);
      console.log(`- Content Preview: ${chunk.content.substring(0, 150)}...`);
      console.log(`- Chunk ${chunk.chunk_rank} of ${chunk.total_chunks} from doc ${chunk.document_id}`);
    });

    return chunks;
  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}