import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

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

  console.log('Creating new assistant...');
  const assistant = await openai.beta.assistants.create({
    name: "ActiBot",
    instructions: `Tu es ActiBot, un assistant qui répond aux questions en utilisant uniquement les informations fournies dans le contexte.

Instructions :
1. Utilise UNIQUEMENT les informations du contexte fourni pour répondre
2. Si tu trouves une information pertinente, même partielle, utilise-la dans ta réponse
3. Si certaines informations manquent, précise ce qui est disponible et ce qui ne l'est pas
4. Cite les passages pertinents du contexte entre guillemets "..."
5. Format de réponse :
   - Commence par une réponse directe à la question
   - Appuie ta réponse avec des citations du contexte
   - Si des informations manquent, explique ce qui manque`,
    model: "gpt-4-turbo-preview"
  });

  ASSISTANT_ID = assistant.id;
  return assistant;
}

// Génération d'embeddings pour la recherche
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  try {
    console.log('Generating embedding for query:', text);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response');
    }

    console.log('Generated embedding length:', response.data[0].embedding.length);
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Recherche de documents similaires avec seuil plus bas et plus de logging
export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  try {
    console.log('Generating embedding for query:', query);
    const queryEmbedding = await generateEmbedding(query);
    console.log('Generated embedding length:', queryEmbedding.length);

    const embeddingString = `[${queryEmbedding.join(',')}]`;

    const result = await db.execute(sql`
      WITH similarity_chunks AS (
        SELECT 
          dc.content,
          d.title as document_title,
          1 - cosine_distance(dc.embedding, (SELECT ${embeddingString}::vector(1536))) as similarity,
          dc.metadata,
          d.id as document_id,
          ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY cosine_distance(dc.embedding, (SELECT ${embeddingString}::vector(1536))) ASC
          ) as chunk_rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
      )
      SELECT 
        content,
        document_title,
        document_id,
        similarity::float4,
        metadata,
        chunk_rank
      FROM similarity_chunks
      WHERE 
        chunk_rank <= 10 AND  -- Increased from 5 to 10 chunks per document
        similarity > 0.005    -- Reduced threshold to catch more potential matches
      ORDER BY similarity DESC
      LIMIT 100;             -- Increased limit to get more context
    `);

    const chunks = result.rows || [];
    console.log(`Found ${chunks.length} relevant chunks with scores:`, 
      chunks.map(c => ({ 
        similarity: c.similarity, 
        title: c.document_title,
        preview: c.content?.substring(0, 100) + '...'
      })));
    return chunks;
  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}

// Nouvelle fonction de chat utilisant les Assistants
export async function getChatResponse(
  question: string,
  context: any[],
  systemPrompt?: string
) {
  try {
    console.log('Processing chat response for question:', question);

    // Ensure context is an array
    if (!Array.isArray(context)) {
      console.warn('Context is not an array:', context);
      context = [];
    }

    const assistant = await getOrCreateAssistant();

    // Créer un nouveau thread
    const thread = await openai.beta.threads.create();

    // Formater le contexte
    const formattedContext = context
      .filter(chunk => chunk && typeof chunk === 'object')
      .map((chunk, index) => {
        console.log('Processing chunk:', {
          title: chunk.document_title,
          similarity: chunk.similarity,
          contentLength: chunk.content?.length
        });

        return `=== Document ${index + 1} ===\n${chunk.content?.trim() || 'No content available'}\n`;
      })
      .join('\n');

    console.log('Formatted context length:', formattedContext.length);
    console.log('Sample of context:', formattedContext.substring(0, 200) + '...');

    // Ajouter le contexte et la question au thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Question : ${question}\n\nContexte disponible :\n\n${formattedContext}`
    });

    // Lancer l'assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    // Attendre la réponse avec timeout
    const startTime = Date.now();
    const TIMEOUT = 45000; // 45 secondes

    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];

        if (lastMessage.role === 'assistant') {
          // Properly handle all content types from the assistant
          const content = lastMessage.content[0];
          if (content.type === 'text') {
            return content.text.value;
          }
          throw new Error('Unsupported response type from assistant');
        }
        throw new Error('Réponse invalide de l\'assistant');
      }

      if (runStatus.status === 'failed') {
        throw new Error('L\'assistant n\'a pas pu générer une réponse');
      }

      if (Date.now() - startTime > TIMEOUT) {
        await openai.beta.threads.runs.cancel(thread.id, run.id);
        throw new Error('La réponse a pris trop de temps. Veuillez réessayer.');
      }

      // Attendre avant la prochaine vérification
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
}