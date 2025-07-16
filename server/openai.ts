import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

// ID of the existing assistant - ActiBot avec gpt-4o-mini
const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

// Generates embeddings for semantic search
export async function generateEmbedding(text: string): Promise<number[]> {
  const enhancedQuery = `outils intelligence artificielle IA ${text} generateur creation image Midjourney Dall-E Stable Diffusion chatbot assistant`;

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: enhancedQuery,
    encoding_format: "float"
  });

  return response.data[0].embedding;
}

// Recherche de documents similaires avec seuil plus bas et plus de logging
export async function findSimilarDocuments(query: string) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query: must be a non-empty string');
  }

  try {
    console.log('Processing search query:', query);
    const queryEmbedding = await generateEmbedding(query);

    const embeddingString = `[${queryEmbedding.join(',')}]`;

    const result = await db.execute(sql`
      WITH similarity_chunks AS (
        SELECT 
          dc.content,
          d.title as document_title,
          (dc.embedding <#> ${embeddingString}::vector) * -1 as similarity,
          dc.metadata,
          d.id as document_id,
          ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY (dc.embedding <#> ${embeddingString}::vector) ASC
          ) as chunk_rank,
          COUNT(*) OVER (PARTITION BY d.id) as total_chunks
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.content IS NOT NULL AND LENGTH(dc.content) > 0
      )
      SELECT 
        content,
        document_title,
        document_id,
        similarity::float4,
        metadata,
        chunk_rank,
        total_chunks
      FROM similarity_chunks
      WHERE 
        chunk_rank <= 15
      ORDER BY similarity DESC, document_id, chunk_rank
      LIMIT 150;
    `);

    const chunks = result.rows.map(row => ({
      ...row,
      content: row.content || '',
      similarity: Number(row.similarity) || 0,
      document_title: row.document_title || 'Untitled',
      chunk_rank: Number(row.chunk_rank) || 1,
      total_chunks: Number(row.total_chunks) || 1
    }));

    // Log detailed information about found chunks
    console.log(`Found ${chunks.length} relevant chunks across ${new Set(chunks.map(c => c.document_id)).size} documents`);
    chunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(`- Document: ${chunk.document_title}`);
      console.log(`- Similarity: ${(chunk.similarity * 100).toFixed(2)}%`);
      console.log(`- Content Preview: ${chunk.content.substring(0, 150)}...`);
      console.log(`- Chunk ${chunk.chunk_rank} of ${chunk.total_chunks} from doc ${chunk.document_id}`);
    });

    return chunks;
  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}

// Main chat function using the specified Assistant
export async function getChatResponse(
  question: string,
  history: any[] = []
) {
  try {
    // Create a new thread
    const thread = await openai.beta.threads.create();

    // Add previous messages from history if any
    if (history.length > 0) {
      for (const msg of history.slice(-3)) {
        if (msg.message) {
          await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: msg.message
          });
        }
        if (msg.response) {
          await openai.beta.threads.messages.create(thread.id, {
            role: "assistant",
            content: msg.response
          });
        }
      }
    }

    // Add the new question
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question
    });

    // Run the assistant with the existing ID
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    // Wait for completion
    let status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (status.status !== 'completed') {
      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new Error(`Run failed with status: ${status.status}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    if (!lastMessage || lastMessage.role !== 'assistant') {
      throw new Error('No assistant response found');
    }

    const content = lastMessage.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Process annotations to replace source references with actual links
    let responseText = content.text.value;
    
    // Get annotations from the response
    const annotations = content.text.annotations || [];
    
    for (const annotation of annotations) {
      if (annotation.type === 'file_citation') {
        // Get file information
        const fileId = annotation.file_citation.file_id;
        
        try {
          // Get file details from OpenAI
          const fileInfo = await openai.files.retrieve(fileId);
          const fileName = fileInfo.filename;
          
          // Remove the annotation completely - we want clean links only
          responseText = responseText.replace(annotation.text, '');
          
        } catch (error) {
          console.error('Error retrieving file info:', error);
          // Fallback: just remove the annotation
          responseText = responseText.replace(annotation.text, '');
        }
      }
    }
    
    // Extract and make links clickable in the response
    // First, check if the link is already in markdown format
    const existingMarkdownLinks = responseText.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g);
    
    const linkRegex = /(https?:\/\/[^\s\)\]]+)/g;
    responseText = responseText.replace(linkRegex, (match) => {
      // Skip if this link is already part of a markdown link
      if (existingMarkdownLinks && existingMarkdownLinks.some(mdLink => mdLink.includes(match))) {
        return match;
      }
      
      // Clean up the link (remove trailing punctuation)
      const cleanLink = match.replace(/[.,;!?]+$/, '');
      
      // Create descriptive link text based on domain
      let linkText = cleanLink;
      if (cleanLink.includes('support.google.com/gemini')) {
        linkText = '🔗 Aide Google Gemini';
      } else if (cleanLink.includes('youtube.com') || cleanLink.includes('youtu.be')) {
        linkText = '🎥 Vidéo YouTube';
      } else if (cleanLink.includes('share.google')) {
        linkText = '📁 Lien partagé Google';
      } else if (cleanLink.includes('video.umontpellier.fr')) {
        linkText = '🎬 Vidéo Université';
      } else {
        // For other links, show the domain
        try {
          const url = new URL(cleanLink);
          linkText = `🔗 ${url.hostname}`;
        } catch (e) {
          linkText = '🔗 Lien';
        }
      }
      
      return `[${linkText}](${cleanLink})`;
    });

    return responseText;

  } catch (error) {
    console.error('Error in chat response:', error);
    throw new Error('Une erreur est survenue lors de la génération de la réponse. Veuillez réessayer.');
  }
}