import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 1500; // Reduced chunk size for better context management
const MAX_TOKENS = 1000; // Augmenté pour des réponses plus complètes
const MAX_CONTEXT_LENGTH = 12000; // Increased for more comprehensive responses
const MIN_SIMILARITY_THRESHOLD = 0.7; // Seuil minimum de similarité

function truncateText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;

  // Estimate tokens (roughly 4 characters per token)
  const maxTokens = Math.floor(maxLength / 4);
  const estimatedMaxLength = maxTokens * 4;

  // Try to end at a sentence or paragraph break
  let truncated = text.slice(0, estimatedMaxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > estimatedMaxLength * 0.8) {
    return truncated.slice(0, breakPoint + 1);
  }

  return truncated + "...";
}

function chunkText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // Diviser d'abord par paragraphes
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // Si le paragraphe lui-même est trop long, le diviser en phrases
    if (paragraph.length > MAX_CHUNK_SIZE) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

      for (const sentence of sentences) {
        if ((currentChunk + '\n' + sentence).length > MAX_CHUNK_SIZE) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += '\n' + sentence;
        }
      }
    } else if ((currentChunk + '\n\n' + paragraph).length > MAX_CHUNK_SIZE) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function generateEmbedding(text: string) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a string');
  }

  const cleanedText = text.replace(/\n+/g, " ").trim();
  if (!cleanedText) {
    throw new Error('Invalid input: text is empty after cleaning');
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: cleanedText,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  const queryEmbedding = await generateEmbedding(query);

  // Use pgvector to find the most relevant chunks
  const relevantChunks = await db.execute(sql`
    SELECT 
      dc.content,
      dc.metadata,
      d.title,
      1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}) as similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}
    LIMIT 5
  `);

  if (!Array.isArray(relevantChunks)) {
    return [];
  }

  // Filter and sort chunks by relevance
  return relevantChunks
    .filter((chunk: any) => chunk && chunk.similarity >= MIN_SIMILARITY_THRESHOLD)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, 3);
}

export async function getChatResponse(
  question: string, 
  context: string, 
  systemPrompt?: string,
  history: Array<{ role: string; content: string; }> = [],
  model: OpenAIModel = "gpt-4o-mini" 
) {
  try {
    if (!question || typeof question !== 'string') {
      throw new Error('Invalid question: must be a non-empty string');
    }

    // Build structured context with metadata
    const structuredContext = context ? `
Context available:
${context}
` : '';

    // Reduce history to minimum
    const limitedHistory = history.slice(-2).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: truncateText(msg.content, 1000)
    }));

    // Build system prompt with structured context
    const basePrompt = systemPrompt || `Tu es un assistant expert pour cette communauté WhatsApp, spécialisé dans les explications détaillées et structurées.

Pour chaque réponse, tu dois :
1. Analyser toutes les sources fournies
2. Structurer ta réponse en sections claires :
   - Introduction et contexte
   - Points principaux avec explications détaillées
   - Exemples concrets et cas d'utilisation
   - Résumé des points clés
3. Utiliser le formatage Markdown pour améliorer la lisibilité :
   - **Gras** pour les concepts importants
   - *Italique* pour les nuances ou précisions
   - Listes numérotées pour les étapes
   - Citations pour les extraits directs`;

    const contextPrompt = `
${basePrompt}

${structuredContext}

Question : ${question}

Assure-toi d'exploiter toutes les informations pertinentes des sources fournies.
`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: contextPrompt
        },
        ...limitedHistory,
        {
          role: "user",
          content: question
        }
      ],
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return response.choices[0].message.content || "Désolé, je n'ai pas pu générer une réponse.";
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`Erreur lors de la génération de la réponse: ${error.message}`);
  }
}