import OpenAI from "openai";
import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 1500; // Optimized chunk size
const MAX_TOKENS = 2000; // Increased for more detailed responses
const MAX_CONTEXT_LENGTH = 15000; // Maximum context length
const MIN_SIMILARITY_THRESHOLD = 0.65; // Similarity threshold

interface ChunkMetadata {
  heading?: string;
  subheading?: string;
  keywords?: string[];
}

interface ProcessedChunk {
  content: string;
  startOffset: number;
  endOffset: number;
  metadata?: ChunkMetadata;
}

// Improved chunking system with metadata and intelligent boundaries
function chunkDocument(content: string, chunkSize = MAX_CHUNK_SIZE): ProcessedChunk[] {
  const chunks: ProcessedChunk[] = [];
  let startOffset = 0;

  // Split into sections by headers
  const sections = content.split(/(?=#{1,6}\s)/);

  for (const section of sections) {
    // Extract heading and content
    const [heading, ...contentParts] = section.split('\n');
    const sectionContent = contentParts.join('\n');

    // Process paragraphs within section
    const paragraphs = sectionContent.split(/\n\n+/);
    let currentChunk = '';
    let chunkStartOffset = startOffset;
    let metadata: ChunkMetadata = {
      heading: heading.trim().replace(/^#{1,6}\s/, ''),
      keywords: extractKeywords(sectionContent)
    };

    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

      if (potentialChunk.length > chunkSize && currentChunk) {
        // Store current chunk before starting new one
        chunks.push({
          content: currentChunk,
          startOffset: chunkStartOffset,
          endOffset: chunkStartOffset + currentChunk.length,
          metadata
        });

        currentChunk = paragraph;
        chunkStartOffset = startOffset + paragraph.length;
      } else {
        currentChunk = potentialChunk;
      }

      startOffset += paragraph.length + 2; // +2 for paragraph separators
    }

    // Add remaining content as final chunk
    if (currentChunk) {
      chunks.push({
        content: currentChunk,
        startOffset: chunkStartOffset,
        endOffset: chunkStartOffset + currentChunk.length,
        metadata
      });
    }
  }

  return chunks;
}

// Helper function to extract important keywords from text
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

  // Enhanced similarity search with context windows
  const relevantChunks = await db.execute(sql`
    WITH ranked_chunks AS (
      SELECT 
        dc.id,
        dc.content,
        dc.document_id,
        dc.metadata,
        d.title as document_title,
        1 - (dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        LAG(dc.content) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as previous_chunk,
        LEAD(dc.content) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as next_chunk,
        LAG(dc.metadata) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as previous_metadata,
        LEAD(dc.metadata) OVER (PARTITION BY dc.document_id ORDER BY dc.chunk_index) as next_metadata
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
      ORDER BY dc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 10
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
      context: formatContext(chunk)
    }))
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, 5);
}

function formatContext(chunk: any): string {
  const metadata = chunk.metadata || {};
  const parts = [
    `Document: ${chunk.document_title}`,
  ];

  if (metadata.heading) {
    parts.push(`Section: ${metadata.heading}`);
  }

  if (metadata.keywords?.length) {
    parts.push(`Keywords: ${metadata.keywords.join(', ')}`);
  }

  return parts.join(' | ');
}

// Enhanced response processing
class ResponseEnhancer {
  private async addCitations(response: string, sources: any[]): Promise<string> {
    let enhancedResponse = response;

    for (const source of sources) {
      if (source.content && enhancedResponse.includes(source.content)) {
        enhancedResponse = enhancedResponse.replace(
          source.content,
          `> ${source.content}\n(Source: ${source.context})`
        );
      }
    }

    return enhancedResponse;
  }

  private async expandDefinitions(response: string): Promise<string> {
    // Identify technical terms and add brief definitions
    const terms = response.match(/\*\*([^*]+)\*\*/g) || [];
    let enhancedResponse = response;

    for (const term of terms) {
      const cleanTerm = term.replace(/\*/g, '');
      try {
        const definition = await this.getDefinition(cleanTerm);
        if (definition) {
          enhancedResponse = enhancedResponse.replace(
            term,
            `${term} (${definition})`
          );
        }
      } catch (error) {
        console.error(`Error getting definition for ${cleanTerm}:`, error);
      }
    }

    return enhancedResponse;
  }

  private async getDefinition(term: string): Promise<string | null> {
    // Implement definition lookup logic here
    // For now, return null to avoid adding undefined definitions
    return null;
  }

  async enhance(response: string, sources: any[]): Promise<string> {
    let enhanced = response;
    enhanced = await this.addCitations(enhanced, sources);
    enhanced = await this.expandDefinitions(enhanced);
    return enhanced;
  }
}

const responseEnhancer = new ResponseEnhancer();

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
Context provided:
${context}

Related documents have been analyzed and integrated into this response.
` : '';

    const limitedHistory = history.slice(-3).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.slice(0, 1500)
    }));

    const basePrompt = systemPrompt || `En tant qu'assistant IA multilingue spécialisé dans le traitement de documents, je suis là pour vous aider à analyser, comprendre et extraire des informations pertinentes des documents.

Instructions spécifiques :
1. Répondre de manière claire et précise aux questions sur le contenu des documents
2. Utiliser le contexte fourni pour donner des réponses pertinentes
3. Maintenir une conversation naturelle et professionnelle
4. Citer les sources quand c'est pertinent
5. Demander des clarifications si la question n'est pas claire
6. Respecter la confidentialité des informations

Pour chaque réponse :
- Fournir des informations précises basées sur les documents
- Structurer la réponse de manière logique
- Utiliser des exemples quand c'est pertinent
- Indiquer clairement si une information n'est pas disponible dans les documents`;

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
      frequency_penalty: 0.2,
      top_p: 0.9,
    });

    const initialResponse = response.choices[0].message.content || "Sorry, I couldn't generate a response.";

    // Post-process and enhance the response
    const enhancedResponse = await responseEnhancer.enhance(initialResponse, context ? [{ content: context }] : []);

    return enhancedResponse;
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