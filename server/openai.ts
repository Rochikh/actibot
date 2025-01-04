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
    const result = await db.execute(sql`
      WITH similarity_search AS (
        SELECT 
          dc.content,
          d.title as document_title,
          1 - (dc.embedding <=> ${sql`[${queryEmbedding.join(',')}]::vector`}) as similarity,
          dc.metadata,
          ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY dc.embedding <=> ${sql`[${queryEmbedding.join(',')}]::vector`}
          ) as chunk_rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
      )
      SELECT 
        content,
        document_title,
        similarity::float4,
        metadata,
        chunk_rank
      FROM similarity_search
      WHERE 
        chunk_rank <= 3 AND
        similarity > 0.1
      ORDER BY similarity DESC
      LIMIT 30;
    `);

    const chunks = result.rows || [];

    // Debug logging
    console.log(`Found ${chunks.length} relevant chunks`);
    chunks.forEach((chunk, index) => {
      console.log(`
        Chunk ${index + 1}:
        - Similarity: ${chunk.similarity?.toFixed(4) || 'N/A'}
        - Title: ${chunk.document_title || 'Untitled'}
        - Preview: ${chunk.content?.substring(0, 100)}...
      `);
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


// Format du prompt système optimisé
export async function getChatResponse(
  question: string, 
  context: string,
  systemPrompt?: string,
  history: Array<{ role: "system" | "user" | "assistant"; content: string; }> = [],
  model: OpenAIModel = "gpt-4o"
) {
  const contextPrompt = `Tu es un assistant spécialisé intégré à ActiBot. Tu as accès à une base de connaissances de documents.

Contexte fourni :
${context}

Instructions :
- Base tes réponses UNIQUEMENT sur le contexte ci-dessus
- Inclus systématiquement des citations directes du texte entre guillemets
- Si une information n'est pas dans le contexte, réponds clairement "Cette information n'est pas présente dans le contexte fourni"
- Structure ta réponse avec des paragraphes clairs

Question : ${question}`;

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
    top_p: 0.9,
  });

  const result = response.choices[0].message.content;
  await verifyResponse(result || "", context ? [context] : []);
  return result || "Désolé, je n'ai pas pu générer une réponse.";
}

// Système de vérification des réponses
const verifyResponse = async (response: string, context: string[]) => {
  const contextElements = context.map(c => c.substring(0, 50));
  const containsContext = contextElements.some(e => 
    response.toLowerCase().includes(e.toLowerCase())
  );

  if (!containsContext) {
    console.warn('Warning: Response may not use provided context');
  }

  const citationCount = (response.match(/"|«|»/g) || []).length / 2;
  if (citationCount < 1) {
    console.warn('Warning: Response contains no citations');
  }

  return {
    usesContext: containsContext,
    citationCount,
    length: response.length
  };
};

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