import { type Document, type OpenAIModel, type DocumentChunk } from "@db/schema";
import { db } from "@db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

// ID de l'assistant créé
let ASSISTANT_ID: string | null = null;

async function getOrCreateAssistant() {
  if (ASSISTANT_ID) {
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      return assistant;
    } catch (error) {
      console.warn('Failed to retrieve assistant, creating new one:', error);
    }
  }

  console.log('Creating new assistant...');
  const assistant = await openai.beta.assistants.create({
    name: "ActiBot",
    instructions: `Tu es ActiBot, un assistant spécialisé qui aide les utilisateurs à trouver des informations sur les outils d'IA.

Instructions :
1. Utilise UNIQUEMENT les informations du contexte fourni pour répondre
2. Pour chaque outil ou service mentionné, cite EXPLICITEMENT le passage pertinent du contexte entre guillemets
3. Si une information est manquante, indique clairement ce qui est disponible et ce qui ne l'est pas
4. Format de réponse :
   - Commence par une vue d'ensemble des outils disponibles
   - Pour chaque outil, fournis les détails trouvés dans le contexte
   - Cite les extraits pertinents du contexte
   - Si des aspects ne sont pas couverts, précise-le`,
    model: "gpt-4-turbo-preview"
  });

  ASSISTANT_ID = assistant.id;
  return assistant;
}

// Génération d'embeddings pour la recherche
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  try {
    const enhancedQuery = `outils intelligence artificielle technologie ${text} generateur creation image Midjourney Dall-E Stable Diffusion`;
    console.log('Generating embedding for enhanced query:', enhancedQuery);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: enhancedQuery,
      encoding_format: "float"
    });

    if (!response.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response');
    }

    console.log('Generated embedding length:', response.data[0].embedding.length);
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
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

    // Using cosine_similarity instead of <=> operator for better compatibility
    const result = await db.execute(sql`
      WITH similarity_chunks AS (
        SELECT 
          dc.content,
          d.title as document_title,
          cosine_similarity(dc.embedding, ${embeddingString}::vector(1536)) as similarity,
          dc.metadata,
          d.id as document_id,
          ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY cosine_similarity(dc.embedding, ${embeddingString}::vector(1536)) DESC
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
        chunk_rank <= 15 AND
        similarity > 0.7
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

// Fonction de chat utilisant les Assistants
export async function getChatResponse(
  question: string,
  context: any[],
  systemPrompt?: string
) {
  try {
    console.log('Processing chat response for question:', question);

    // Ensure context is an array
    if (!Array.isArray(context)) {
      console.warn('Context is not an array:', context);
      context = [];
    }

    const assistant = await getOrCreateAssistant();
    const thread = await openai.beta.threads.create();

    // Group context by document for better organization
    const groupedContext = context.reduce<Record<string, { title: string; chunks: any[] }>>((acc, chunk) => {
      const docId = chunk.document_id?.toString() || 'unknown';
      if (!acc[docId]) {
        acc[docId] = {
          title: chunk.document_title || 'Untitled',
          chunks: []
        };
      }
      acc[docId].chunks.push(chunk);
      return acc;
    }, {});

    const formattedContext = Object.entries(groupedContext)
      .map(([_, doc]) => {
        const sortedChunks = doc.chunks
          .sort((a, b) => (a.chunk_rank || 0) - (b.chunk_rank || 0))
          .map(chunk => chunk.content?.trim())
          .filter(Boolean);
        return `=== ${doc.title} ===\n${sortedChunks.join('\n')}\n`;
      })
      .join('\n\n');

    console.log('Formatted context structure:');
    console.log('- Total documents:', Object.keys(groupedContext).length);
    console.log('- Context length:', formattedContext.length);
    console.log('- Sample of context:', formattedContext.substring(0, 200) + '...');

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Question : ${question}\n\nInformations disponibles :\n\n${formattedContext}`
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    const startTime = Date.now();
    const TIMEOUT = 45000;

    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];

        if (lastMessage.role === 'assistant') {
          const content = lastMessage.content[0];
          if (content.type === 'text') {
            return content.text.value;
          }
          throw new Error('Unsupported response type from assistant');
        }
        throw new Error('Réponse invalide de l\'assistant');
      }

      if (runStatus.status === 'failed') {
        throw new Error('L\'assistant n\'a pas pu générer une réponse');
      }

      if (Date.now() - startTime > TIMEOUT) {
        await openai.beta.threads.runs.cancel(thread.id, run.id);
        throw new Error('La réponse a pris trop de temps. Veuillez réessayer.');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
}