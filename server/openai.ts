import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

// Requête SQL optimisée pour la recherche de similarité
export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  try {
    console.log('Generating embedding for query:', query);
    const queryEmbedding = await generateEmbedding(query);
    console.log('Generated embedding length:', queryEmbedding.length);

    // Enhanced similarity search with context windows
    console.log('Searching for similar chunks...');

    // Convertir le tableau d'embeddings en chaîne formatée pour PostgreSQL
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
        chunk_rank <= 5 AND  -- Augmenté de 3 à 5 chunks par document
        similarity > 0.05    -- Réduit de 0.1 à 0.05 pour plus de résultats
      ORDER BY similarity DESC
      LIMIT 50;             -- Augmenté de 30 à 50 pour plus de contexte
    `);

    const chunks = result.rows || [];
    console.log(`Found ${chunks.length} relevant chunks with similarity scores:`);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}: similarity=${chunk.similarity.toFixed(4)}, document=${chunk.document_title}`);
    });

    return chunks;
  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}

// Génération d'embeddings
export async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });

  return response.data[0].embedding;
}

// Format du prompt système optimisé avec un meilleur formatage du contexte
export async function getChatResponse(
  question: string, 
  context: any[],
  systemPrompt?: string,
  history: Array<{ role: "system" | "user" | "assistant"; content: string; }> = [],
  model: OpenAIModel = "gpt-4o"
) {
  // Amélioration du formatage du contexte
  const formattedContext = context.map(chunk => {
    return `
Document: ${chunk.document_title}
Pertinence: ${(chunk.similarity * 100).toFixed(1)}%
Contenu:
${chunk.content.trim()}
---`;
  }).join('\n\n');

  const contextPrompt = `Tu es un assistant spécialisé intégré à ActiBot qui répond aux questions en se basant sur une base de connaissances de documents.

Contexte trouvé (classé par pertinence) :
${formattedContext}

Instructions :
1. Base tes réponses UNIQUEMENT sur le contexte ci-dessus
2. Cite DIRECTEMENT des passages pertinents du contexte entre guillemets "..."
3. Si l'information n'est pas dans le contexte, dis clairement "Cette information n'est pas présente dans le contexte fourni"
4. Structure ta réponse avec des paragraphes clairs

Question : ${question}`;

  console.log('Sending to OpenAI with context length:', formattedContext.length);

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
    presence_penalty: 0.1,
    frequency_penalty: 0.2,
  });

  const result = response.choices[0].message.content;
  await verifyResponse(result || "", formattedContext);
  return result || "Désolé, je n'ai pas pu générer une réponse.";
}

// Système de vérification des réponses amélioré
const verifyResponse = async (response: string, context: string) => {
  // Vérifier si la réponse contient des citations
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
};

// Types et interfaces
interface ChunkingOptions {
  minSize: number;
  maxSize: number;
  overlap: number;
  breakOnSentence: boolean;
}

const defaultOptions: ChunkingOptions = {
  minSize: 500,
  maxSize: 1500,
  overlap: 200,
  breakOnSentence: true
};

interface ChunkMetadata {
  heading?: string;
  subheading?: string;
  keywords?: string[];
  position?: 'start' | 'middle' | 'end';
}

interface ProcessedChunk {
  content: string;
  startOffset: number;
  endOffset: number;
  metadata?: ChunkMetadata;
}

// Système de chunking intelligent
export function chunkDocument(text: string, options: ChunkingOptions = defaultOptions): ProcessedChunk[] {
  const { minSize, maxSize, overlap, breakOnSentence } = options;

  // Implémentation du chunking avec respect des phrases
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: ProcessedChunk[] = [];
  let currentChunk = '';
  let chunkStartOffset = 0;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxSize && currentChunk.length >= minSize) {
      chunks.push({
        content: currentChunk.trim(),
        startOffset: chunkStartOffset,
        endOffset: chunkStartOffset + currentChunk.length,
        metadata: { 
          position: chunks.length === 0 ? 'start' : 'middle',
          keywords: extractKeywords(currentChunk)
        }
      });
      currentChunk = sentence;
      chunkStartOffset += currentChunk.length;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      startOffset: chunkStartOffset,
      endOffset: chunkStartOffset + currentChunk.length,
      metadata: { 
        position: 'end',
        keywords: extractKeywords(currentChunk)
      }
    });
  }

  return chunks;
}

// Fonction d'extraction de mots-clés améliorée
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  return Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}


const MAX_CHUNK_SIZE = 2000; // Augmenté pour gérer de plus gros chunks
const MAX_TOKENS = 2000; // Increased for more detailed responses
const MAX_CONTEXT_LENGTH = 15000; // Maximum context length
const MIN_SIMILARITY_THRESHOLD = 0.1; // Réduit pour trouver plus de correspondances

// Système de métriques de performance
interface PerformanceMetrics {
  avgSimilarity: number;
  citationCount: number;
  responseTime: number;
  contextUsage: boolean;
}

const trackMetrics = async (metrics: PerformanceMetrics) => {
  console.log('Performance Metrics:', {
    timestamp: new Date().toISOString(),
    ...metrics
  });
};

function formatContext(chunk: any): string {
  const metadata = chunk.metadata || {};
  const parts = [
    `Document: ${chunk.document_title}`,
  ];

  if (metadata.heading) {
    parts.push(`Section: ${metadata.heading}`);
  }

  if (metadata.position) {
    parts.push(`Position: ${metadata.position}`);
  }

  if (metadata.keywords?.length) {
    parts.push(`Keywords: ${metadata.keywords.join(', ')}`);
  }

  return parts.join(' | ');
}

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