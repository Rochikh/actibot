import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// Keep OpenAI client just for embeddings
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000 // 30 second timeout
});

// Webhook URL for Make.com integration
const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/dt9gfk82cb0e5n6rrss049uvowshsj57";

// Fonction utilitaire pour réessayer avec backoff exponentiel
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Attempting operation, attempt ${attempt + 1}`);
      const result = await operation();
      console.log('Operation successful');
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`Failed attempt ${attempt + 1}:`, error.message);

      // Vérifier si l'erreur est récupérable
      const shouldRetry = error.status === 429 || 
                         error.message.includes('timeout') ||
                         error.message.includes('rate limit');

      if (!shouldRetry) {
        throw error;
      }

      // Attendre avec backoff exponentiel
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("All attempts failed");
}

// Requête SQL optimisée pour la recherche de similarité
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
        chunk_rank <= 5 AND
        similarity > 0.05
      ORDER BY similarity DESC
      LIMIT 50;
    `);

    const chunks = result.rows || [];
    console.log(`Found ${chunks.length} relevant chunks with similarity scores:`);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}: similarity=${chunk.similarity?.toFixed(4)}, document=${chunk.document_title}`);
    });

    return chunks;
  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}

// Génération d'embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  return retryWithBackoff(async () => {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response');
    }

    return response.data[0].embedding;
  });
}

// Format du prompt système optimisé avec appel au webhook Make.com
export async function getChatResponse(
  question: string, 
  context: any[],
  systemPrompt?: string,
  history: Array<{ role: "system" | "user" | "assistant"; content: string; }> = []
) {
  try {
    console.log('Processing chat response for question:', question);
    console.log('Context length:', context?.length || 0);

    if (!Array.isArray(context)) {
      console.warn('Context is not an array, using empty array');
      context = [];
    }

    const formattedContext = (context || []).map(chunk => {
      if (!chunk || typeof chunk !== 'object') {
        console.warn('Invalid chunk in context:', chunk);
        return '';
      }

      return `
Document: ${chunk.document_title || 'Unknown Document'}
Pertinence: ${(chunk.similarity * 100).toFixed(1)}%
Contenu:
${chunk.content?.trim() || 'No content available'}
---`;
    }).filter(Boolean).join('\n\n');

    const webhookPayload = {
      question,
      context: formattedContext,
      systemPrompt: systemPrompt || `Tu es un assistant spécialisé intégré à ActiBot qui répond aux questions en se basant sur une base de connaissances de documents.

Contexte trouvé (classé par pertinence) :
${formattedContext || "Aucun contexte pertinent trouvé."}

Instructions :
1. Base tes réponses UNIQUEMENT sur le contexte ci-dessus
2. Cite DIRECTEMENT des passages pertinents du contexte entre guillemets "..."
3. Si l'information n'est pas dans le contexte, dis clairement "Cette information n'est pas présente dans le contexte fourni"
4. Structure ta réponse avec des paragraphes clairs`,
      history: history.slice(-3) // Keep last 3 messages for context
    };

    console.log('Sending request to Make.com webhook');

    return retryWithBackoff(async () => {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000); // 25s timeout

      try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
        }

        const result = await response.text();
        console.log('Received webhook response');

        if (!result) {
          throw new Error('Empty response from webhook');
        }

        await verifyResponse(result, formattedContext);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Chat completion failed:', error);
        throw error;
      }
    });
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
}

// Système de vérification des réponses
async function verifyResponse(response: string, context: string) {
  try {
    const citationCount = (response.match(/"|«|»/g) || []).length / 2;
    const containsContext = context.split('\n').some(line => 
      response.toLowerCase().includes(line.toLowerCase().substring(0, 50))
    );

    console.log('Response verification:', {
      length: response.length,
      citationCount,
      usesContext: containsContext
    });

    if (!containsContext) {
      console.warn('Warning: Response may not use provided context');
    }
    if (citationCount < 1) {
      console.warn('Warning: Response contains no citations');
    }

    return {
      usesContext: containsContext,
      citationCount,
      length: response.length
    };
  } catch (error) {
    console.error('Error in verifyResponse:', error);
    return {
      usesContext: false,
      citationCount: 0,
      length: response.length
    };
  }
}