import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 2000; // Augmenté pour gérer de plus gros chunks
const MAX_TOKENS = 2000; // Increased for more detailed responses
const MAX_CONTEXT_LENGTH = 15000; // Maximum context length
const MIN_SIMILARITY_THRESHOLD = 0.1; // Réduit pour trouver plus de correspondances

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

export function chunkDocument(content: string, chunkSize = MAX_CHUNK_SIZE): ProcessedChunk[] {
  const chunks: ProcessedChunk[] = [];
  let startOffset = 0;

  // Ensure content is a string and not empty
  if (!content || typeof content !== 'string') {
    console.error('Invalid content provided to chunkDocument');
    return [];
  }

  console.log(`Processing document with length: ${content.length}`);

  // Split content into paragraphs with overlap
  const paragraphs = content.split(/\n\n+/);
  console.log(`Number of paragraphs: ${paragraphs.length}`);

  let currentChunk = '';
  let chunkStartOffset = startOffset;
  let chunkPosition = 'start';

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    // Détermine la position du chunk dans le document
    if (i === 0) chunkPosition = 'start';
    else if (i === paragraphs.length - 1) chunkPosition = 'end';
    else chunkPosition = 'middle';

    const metadata: ChunkMetadata = {
      position: chunkPosition as 'start' | 'middle' | 'end',
      keywords: extractKeywords(paragraph)
    };

    // Add overlap by including previous paragraph if available
    let chunkContent = currentChunk;
    if (i > 0) {
      chunkContent = paragraphs[i - 1].trim() + "\n\n" + paragraph;
    }

    if (chunkContent.length > chunkSize && currentChunk) {
      console.log(`Creating chunk at offset ${chunkStartOffset}, length: ${currentChunk.length}`);
      chunks.push({
        content: currentChunk,
        startOffset: chunkStartOffset,
        endOffset: chunkStartOffset + currentChunk.length,
        metadata
      });

      currentChunk = paragraph;
      chunkStartOffset = startOffset;
    } else {
      currentChunk = chunkContent;
    }

    startOffset += paragraph.length + 2;
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      startOffset: chunkStartOffset,
      endOffset: chunkStartOffset + currentChunk.length,
      metadata: { position: 'end', keywords: extractKeywords(currentChunk) }
    });
  }

  return chunks;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction based on frequency and position
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

export async function generateEmbedding(text: string) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a string');
  }

  const cleanedText = text.replace(/\n+/g, " ").trim();
  if (!cleanedText) {
    throw new Error('Invalid input: text is empty after cleaning');
  }

  try {
    console.log(`Generating embedding for text of length: ${cleanedText.length}`);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanedText,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  console.log('Generating embedding for query:', query);
  const queryEmbedding = await generateEmbedding(query);

  // Enhanced similarity search with context windows
  console.log('Searching for similar chunks...');
  const relevantChunks = await db.execute(sql`
    WITH ranked_chunks AS (
      SELECT 
        dc.id,
        dc.content,
        dc.document_id,
        dc.chunk_index,
        dc.metadata,
        d.title as document_title,
        1 - (dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) as chunk_rank
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
    )
    SELECT * FROM ranked_chunks
    WHERE similarity > ${MIN_SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC, chunk_rank
    LIMIT 50
  `);

  if (!Array.isArray(relevantChunks)) {
    console.log('No chunks found');
    return [];
  }

  console.log(`Found ${relevantChunks.length} relevant chunks`);
  relevantChunks.forEach((chunk: any, index: number) => {
    console.log(`Chunk ${index + 1} similarity: ${chunk.similarity}, metadata:`, chunk.metadata);
  });

  // Combine nearby chunks from the same document
  const processedChunks = relevantChunks
    .sort((a: any, b: any) => {
      if (a.document_id === b.document_id) {
        return a.chunk_index - b.chunk_index;
      }
      return b.similarity - a.similarity;
    })
    .slice(0, 20)
    .map((chunk: any) => ({
      ...chunk,
      content: chunk.content,
      context: formatContext(chunk)
    }));

  return processedChunks;
}

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

export async function getChatResponse(
  question: string, 
  context: string, 
  systemPrompt?: string,
  history: Array<{ role: string; content: string; }> = [],
  model: OpenAIModel = "gpt-4o"
) {
  try {
    if (!question || typeof question !== 'string') {
      throw new Error('Invalid question: must be a non-empty string');
    }

    const structuredContext = context ? `
Contexte fourni:
${context}

Les informations ci-dessus proviennent de la base de connaissances. 
Utilisez ces informations pour répondre à la question de manière précise.
` : '';

    const limitedHistory = history.slice(-3).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.slice(0, 1500)
    }));

    const basePrompt = systemPrompt || `En tant qu'assistant IA spécialisé dans l'analyse de documents, je vais vous aider à comprendre et extraire les informations pertinentes des documents.

Instructions spécifiques :
1. Utilisez UNIQUEMENT les informations fournies dans le contexte
2. Si l'information n'est pas dans le contexte, indiquez-le clairement
3. Citez les passages pertinents du contexte
4. Structurez votre réponse de manière claire
5. Si une information manque, demandez des précisions

Format de réponse :
1. Réponse directe à la question
2. Citations pertinentes du contexte
3. Explications supplémentaires si nécessaire`;

    const contextPrompt = `
${basePrompt}

${structuredContext}

Question: ${question}

Répondez en utilisant uniquement les informations du contexte fourni.`;

    console.log('Sending request to OpenAI with context length:', structuredContext.length);

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
      temperature: 0.3, // Réduit pour des réponses plus précises
      max_tokens: MAX_TOKENS,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
      top_p: 0.9,
    });

    const initialResponse = response.choices[0].message.content || "Désolé, je n'ai pas pu générer une réponse.";
    console.log('Received response from OpenAI');

    // Post-process and enhance the response
    return initialResponse;
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`Error generating response: ${error.message}`);
  }
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