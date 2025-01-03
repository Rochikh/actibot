import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 1000; // Optimized chunk size for better context retrieval
const MAX_TOKENS = 1000; // Maximum tokens for response generation
const MAX_CONTEXT_LENGTH = 12000; // Maximum context length
const MIN_SIMILARITY_THRESHOLD = 0.7; // Minimum similarity threshold

function chunkDocument(content: string, chunkSize = MAX_CHUNK_SIZE): Array<{
  content: string;
  startOffset: number;
  endOffset: number;
}> {
  const chunks = [];
  let startOffset = 0;

  // Split intelligently at paragraphs
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk,
        startOffset,
        endOffset: startOffset + currentChunk.length,
      });
      startOffset += currentChunk.length;
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      startOffset,
      endOffset: startOffset + currentChunk.length,
    });
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

  // Using proper vector similarity search with context
  const relevantChunks = await db.execute(sql`
    WITH ranked_chunks AS (
      SELECT 
        dc.id,
        dc.content,
        dc.document_id,
        d.title as document_title,
        1 - (dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        LAG(dc.content) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as previous_chunk,
        LEAD(dc.content) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as next_chunk
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
      ORDER BY dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 5
    )
    SELECT * FROM ranked_chunks
    WHERE similarity > ${MIN_SIMILARITY_THRESHOLD}
  `);

  if (!Array.isArray(relevantChunks)) {
    return [];
  }

  return relevantChunks
    .map((chunk: any) => ({
      ...chunk,
      content: `${chunk.previous_chunk ? chunk.previous_chunk + "\n\n" : ""}${chunk.content}${chunk.next_chunk ? "\n\n" + chunk.next_chunk : ""}`,
      context: `Document: ${chunk.document_title}`
    }))
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

    const structuredContext = context ? `
Context provided:
${context}
` : '';

    const limitedHistory = history.slice(-2).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.slice(0, 1000)
    }));

    const basePrompt = systemPrompt || `You are an expert assistant for this WhatsApp community, specialized in detailed and structured explanations.

For each response, you must:
1. Analyze all provided sources
2. Structure your response in clear sections:
   - Introduction and context
   - Main points with detailed explanations
   - Concrete examples and use cases
   - Summary of key points
3. Use Markdown formatting to improve readability:
   - **Bold** for important concepts
   - *Italic* for nuances or precisions
   - Numbered lists for steps
   - Quotes for direct excerpts`;

    const contextPrompt = `
${basePrompt}

${structuredContext}

Question: ${question}

Make sure to use all relevant information from the provided sources.
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

    return response.choices[0].message.content || "Sorry, I couldn't generate a response.";
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