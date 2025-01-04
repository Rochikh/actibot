import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// Configuration OpenRouter avec gestion de fallback
const openai = new OpenAI({ 
  apiKey: process.env.OPENROUTER_API_KEY || "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",
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5000",
    "X-Title": "ActiBot",
    "Content-Type": "application/json"
  },
  timeout: 30000 // 30 second timeout
});

// Liste des modèles par ordre de préférence avec leurs endpoints
const MODELS = {
  chat: [
    "google/palm-2-chat-bison-001", // Ajout d'un modèle plus fiable en premier
    "anthropic/claude-2",
    "google/gemini-pro",
    "openai/gpt-3.5-turbo"
  ],
  embedding: [
    "google/embedding-gecko-001",
    "openai/text-embedding-ada-002",
    "cohere/embed-english-v3.0"
  ]
};

// Fonction utilitaire pour réessayer avec différents modèles
async function tryWithFallback<T>(
  models: string[],
  operation: (model: string) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Trying model ${model}, attempt ${attempt + 1}`);
        const result = await operation(model);
        console.log(`Success with model ${model}`);
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed with model ${model}, attempt ${attempt + 1}:`, error.message);

        // Vérifier les erreurs spécifiques qui nécessitent un retry
        const shouldRetry = error.status === 404 || 
                          error.status === 429 || 
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
  }

  throw lastError || new Error("All models failed");
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

// Génération d'embeddings avec fallback
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  return tryWithFallback(MODELS.embedding, async (model) => {
    const response = await openai.embeddings.create({
      model,
      input: text,
      encoding_format: "float"
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response');
    }

    return response.data[0].embedding;
  });
}

// Format du prompt système optimisé
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

    const contextPrompt = `Tu es un assistant spécialisé intégré à ActiBot qui répond aux questions en se basant sur une base de connaissances de documents.

Contexte trouvé (classé par pertinence) :
${formattedContext || "Aucun contexte pertinent trouvé."}

Instructions :
1. Base tes réponses UNIQUEMENT sur le contexte ci-dessus
2. Cite DIRECTEMENT des passages pertinents du contexte entre guillemets "..."
3. Si l'information n'est pas dans le contexte, dis clairement "Cette information n'est pas présente dans le contexte fourni"
4. Structure ta réponse avec des paragraphes clairs

Question : ${question}`;

    console.log('Total context length:', contextPrompt.length);

    return tryWithFallback(MODELS.chat, async (model) => {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000); // 25s timeout

      try {
        console.log(`Attempting chat completion with model: ${model}`);
        const response = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt || contextPrompt
            },
            ...history.slice(-3),
            {
              role: "user",
              content: question
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          presence_penalty: 0,
          frequency_penalty: 0
        }, { signal: abortController.signal });

        clearTimeout(timeoutId);

        if (!response.choices?.[0]?.message?.content) {
          throw new Error('Invalid response structure');
        }

        const result = response.choices[0].message.content;
        await verifyResponse(result, formattedContext);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Chat completion failed with model ${model}:`, error);
        throw error;
      }
    });
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
}

// Système de vérification des réponses amélioré
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