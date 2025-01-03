import OpenAI from "openai";
import { type Document, type OpenAIModel } from "@db/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 4000; // Safe size to stay under token limits
const MAX_TOKENS = 1000; // Augmenté pour des réponses plus complètes
const MAX_CONTEXT_LENGTH = 8000; // Reduced context length to stay well under limits

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Estimate tokens (roughly 4 characters per token)
  const maxTokens = Math.floor(maxLength / 4);
  const estimatedMaxLength = maxTokens * 4;

  return text.slice(0, estimatedMaxLength) + "...";
}

function chunkText(text: string): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > MAX_CHUNK_SIZE) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function generateEmbedding(text: string) {
  const chunks = chunkText(text);
  const embeddings = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });
      return response.data[0].embedding;
    })
  );

  // Average the embeddings for each dimension
  const numDimensions = embeddings[0].length;
  const averageEmbedding = new Array(numDimensions).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < numDimensions; i++) {
      averageEmbedding[i] += embedding[i] / embeddings.length;
    }
  }

  return averageEmbedding;
}

export async function findSimilarDocuments(documents: Document[], query: string) {
  const queryEmbedding = await generateEmbedding(query);

  // Only get the most relevant document to reduce context size
  return documents
    .map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[])
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 1); // Get only the most relevant document
}

export async function getChatResponse(
  question: string, 
  context: string, 
  systemPrompt?: string,
  history?: Array<{ role: string; content: string; }> = [],
  model: OpenAIModel = "gpt-4o-mini" 
) {
  try {
    // Tronquer le contexte de manière agressive
    const truncatedContext = truncateText(context, MAX_CONTEXT_LENGTH);

    // Réduire l'historique au strict minimum
    const limitedHistory = history?.slice(-1).map(msg => ({
      ...msg,
      content: truncateText(msg.content, 1000) // Limiter chaque message d'historique
    })) || [];

    // Construire le prompt système avec un contexte limité
    const basePrompt = systemPrompt || "Tu es un assistant expert pour cette communauté WhatsApp.";
    const contextPrompt = truncateText(`
${basePrompt}

Instructions importantes:
1. Utilise uniquement les informations fournies dans la base de connaissance ci-dessous pour répondre aux questions.
2. Si tu ne trouves pas l'information dans la base de connaissance, dis-le clairement.
3. Cite toujours tes sources quand tu utilises une information de la base de connaissance.
4. Donne des réponses complètes et détaillées tout en restant structuré.

Base de connaissance:
${truncatedContext}

---
N'oublie pas : Base tes réponses uniquement sur les informations ci-dessus.
`, 10000);

    const messages = [
      {
        role: "system" as const,
        content: contextPrompt
      },
      ...limitedHistory,
      {
        role: "user" as const,
        content: truncateText(question, 1000)
      }
    ];

    console.log("Using model:", model);
    console.log("Messages token count estimate:", JSON.stringify(messages).length / 4); // Rough estimation

    const response = await openai.chat.completions.create({
      model: model,
      messages,
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