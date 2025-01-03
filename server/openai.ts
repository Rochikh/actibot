import OpenAI from "openai";
import { type Document, type OpenAIModel } from "@db/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 4000; // Safe size to stay under token limits
const MAX_TOKENS = 400; // Limite maximale de tokens pour les réponses

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

  return documents
    .map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[])
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

export async function getChatResponse(
  question: string, 
  context: string, 
  systemPrompt?: string,
  history?: Array<{ role: string; content: string; }> = [],
  model: OpenAIModel = "gpt-4o-mini" 
) {
  const messages = [];

  // Construct a more detailed system prompt that includes context from documents
  const basePrompt = systemPrompt || "Tu es un assistant expert pour cette communauté WhatsApp.";
  const contextPrompt = `
${basePrompt}

Instructions importantes:
1. Utilise uniquement les informations fournies dans la base de connaissance ci-dessous pour répondre aux questions.
2. Si tu ne trouves pas l'information dans la base de connaissance, dis-le clairement.
3. Cite toujours tes sources quand tu utilises une information de la base de connaissance.
4. Formate tes réponses de manière claire et structurée.

Base de connaissance:
${context}

---
N'oublie pas : Base tes réponses uniquement sur les informations ci-dessus.
`;

  // Add the enhanced system prompt
  messages.push({
    role: "system" as const,
    content: contextPrompt
  });

  // Add conversation history
  history?.forEach(msg => {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content
    });
  });

  // Add current question
  messages.push({
    role: "user" as const,
    content: question
  });

  console.log("Using model:", model);
  console.log("System prompt:", contextPrompt);

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages,
      temperature: 0.7,
      max_tokens: MAX_TOKENS, 
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return response.choices[0].message.content || "Désolé, je n'ai pas pu générer une réponse.";
  } catch (error) {
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