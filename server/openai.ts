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

  // Utiliser pgvector pour trouver les chunks les plus pertinents
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

  // Filtrer et trier les chunks par pertinence
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

    // Rechercher les documents pertinents
    const relevantChunks = await findSimilarDocuments(question);

    // Construire un contexte structuré avec les métadonnées
    const structuredContext = relevantChunks
      .map((chunk: any, index: number) => `
Document ${index + 1}: ${chunk.title || 'Sans titre'}
Pertinence: ${Math.round((chunk.similarity || 0) * 100)}%
---
${chunk.content || ''}
`)
      .join('\n\n');

    // Tronquer le contexte de manière intelligente
    const truncatedContext = truncateText(structuredContext, MAX_CONTEXT_LENGTH);

    // Réduire l'historique au strict minimum
    const limitedHistory = history.slice(-2).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: truncateText(msg.content, 1000)
    }));

    // Construire le prompt système avec un contexte structuré
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

SOURCES D'INFORMATION DISPONIBLES :
${truncatedContext}

INSTRUCTIONS IMPORTANTES :
1. Analyse TOUTES les sources ci-dessus, pas seulement la première
2. Pour chaque information importante, indique la source (Document X)
3. Si une information manque ou est incomplète, signale-le clairement
4. Développe chaque point en détail avec des explications et exemples
5. Structure ta réponse de manière claire et logique

Question : ${question}

Assure-toi d'exploiter toutes les informations pertinentes des sources fournies.
`;

    console.log("Using model:", model);
    console.log("Number of relevant chunks:", relevantChunks.length);
    console.log("Context length estimate:", contextPrompt.length / 4);

    const response = await openai.chat.completions.create({
      model: model,
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

function cosineSimilarity(a: number[], b: number[]) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}