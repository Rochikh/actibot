import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 1500; // Increased for better context comprehension
const MAX_TOKENS = 1500; // Increased for more detailed responses
const MAX_CONTEXT_LENGTH = 15000; // Increased to handle more context
const MIN_SIMILARITY_THRESHOLD = 0.65; // Slightly lowered to get more relevant chunks

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

  // Using proper vector similarity search with context, increased limit to 8
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
      LIMIT 8
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
    .slice(0, 5); // Keep top 5 most relevant chunks
}

export async function getChatResponse(
  question: string, 
  context: string, 
  systemPrompt?: string,
  history: Array<{ role: string; content: string; }> = [],
  model: OpenAIModel = "gpt-4o" // Using the most capable model
) {
  try {
    if (!question || typeof question !== 'string') {
      throw new Error('Invalid question: must be a non-empty string');
    }

    const structuredContext = context ? `
Context provided:
${context}

Related documents have been analyzed and integrated into this response.
` : '';

    const limitedHistory = history.slice(-3).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.slice(0, 1500) // Increased context from history
    }));

    const basePrompt = systemPrompt || `You are an expert AI assistant specialized in providing comprehensive, well-structured, and detailed explanations. Your responses should be thorough while maintaining clarity and relevance.

For each response, you must:
1. Carefully analyze all provided sources and context
2. Structure your response in clear, hierarchical sections:
   - Executive Summary (2-3 sentences overview)
   - Detailed Analysis
     * Main concepts and their relationships
     * Key insights from the provided context
     * Technical details when relevant
   - Practical Applications
     * Real-world examples
     * Use cases and implementation scenarios
   - Additional Considerations
     * Important caveats or limitations
     * Best practices and recommendations
3. Use advanced Markdown formatting to enhance readability:
   - **Bold** for crucial concepts and key terms
   - *Italic* for emphasis and nuanced points
   - Numbered lists for sequential steps or prioritized points
   - Bullet points for parallel ideas
   - > Blockquotes for direct citations or important notes
   - Code blocks for technical content when applicable
   - ### Headers for major sections

Ensure your response is:
- Comprehensive yet focused on the most relevant information
- Backed by the provided context and sources
- Logically structured and easy to follow
- Practical and actionable when applicable`;

    const contextPrompt = `
${basePrompt}

${structuredContext}

Question: ${question}

Ensure your response:
1. Integrates information from all relevant sources
2. Provides concrete examples and applications
3. Addresses potential follow-up questions
4. Maintains proper formatting and structure`;

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
      frequency_penalty: 0.2, // Increased for more diverse responses
      top_p: 0.9, // Added for better response quality
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