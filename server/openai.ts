import OpenAI from "openai";
import { type Document } from "@db/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
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

export async function getChatResponse(question: string, context: string, systemPrompt?: string) {
  const messages = [];

  // Add system prompt if provided, otherwise use default
  messages.push({
    role: "system",
    content: systemPrompt || `You are a helpful assistant. Use the following context to answer questions: ${context}`
  });

  // Add context and question
  messages.push({
    role: "user",
    content: question
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 500
  });

  return response.choices[0].message.content;
}

function cosineSimilarity(a: number[], b: number[]) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}