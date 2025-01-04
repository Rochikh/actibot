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
    "X-Title": "ActiBot"
  }
});

// Liste des modèles par ordre de préférence
const MODELS = {
  chat: [
    "anthropic/claude-2",
    "openai/gpt-4-turbo-preview",
    "openai/gpt-3.5-turbo",
    "google/gemini-pro"
  ],
  embedding: [
    "openai/text-embedding-ada-002",
    "openai/text-embedding-3-small",
    "google/embedding-001"
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
        return await operation(model);
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed with model ${model}, attempt ${attempt + 1}:`, error.message);

        // Si ce n'est pas une erreur 404, ne pas réessayer avec d'autres modèles
        if (error.status !== 404) {
          throw error;
        }

        // Attendre un peu avant de réessayer
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
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
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response from OpenRouter');
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
    console.log('Received context:', JSON.stringify(context, null, 2));

    if (!Array.isArray(context)) {
      console.error('Context is not an array:', context);
      context = [];
    }

    const formattedContext = context.map(chunk => {
      if (!chunk || typeof chunk !== 'object') {
        console.error('Invalid chunk in context:', chunk);
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

    console.log('Sending to OpenRouter with context length:', formattedContext.length);

    return tryWithFallback(MODELS.chat, async (model) => {
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
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenRouter');
      }

      const result = response.choices[0].message.content;
      await verifyResponse(result || "", formattedContext);
      return result || "Désolé, je n'ai pas pu générer une réponse.";
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