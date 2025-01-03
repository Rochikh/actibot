import OpenAI from "openai";
import { type Document, type OpenAIModel } from "@db/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const MAX_CHUNK_SIZE = 4000; // Safe size to stay under token limits
const MAX_TOKENS = 1000; // Augmenté pour des réponses plus complètes
const MAX_CONTEXT_LENGTH = 8000; // Reduced context length to stay well under limits
const MIN_SIMILARITY_THRESHOLD = 0.7; // Seuil minimum de similarité

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

  // Get all documents with their similarity scores
  const scoredDocuments = documents
    .map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[])
    }))
    .filter(doc => doc.similarity >= MIN_SIMILARITY_THRESHOLD) // Filter by minimum similarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3); // Get top 3 most relevant documents

  // Si aucun document ne dépasse le seuil, prendre le plus pertinent
  if (scoredDocuments.length === 0 && documents.length > 0) {
    return [documents
      .map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[])
      }))
      .sort((a, b) => b.similarity - a.similarity)[0]];
  }

  return scoredDocuments;
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
    const basePrompt = systemPrompt || `Tu es un assistant expert pour cette communauté WhatsApp, spécialisé dans les explications détaillées et structurées.

Pour chaque réponse, tu dois :
1. Commencer par une introduction claire du sujet
2. Développer chaque point important avec :
   - Une explication détaillée
   - Des exemples concrets d'utilisation
   - Les avantages et limitations
3. Structurer ta réponse avec des sections logiques
4. Conclure en résumant les points clés

N'hésite pas à utiliser des listes numérotées et le formatage Markdown pour améliorer la lisibilité.`;

    const contextPrompt = truncateText(`
${basePrompt}

Instructions importantes pour la recherche d'informations :
1. Base tes réponses uniquement sur les informations fournies dans la base de connaissance ci-dessous.
2. Si une information n'est pas dans la base de connaissance, indique-le clairement.
3. Pour chaque information importante, cite la source spécifique de la base de connaissance.
4. Développe chaque point de manière approfondie avec des explications et des exemples.
5. Utilise le formatage markdown pour structurer ta réponse :
   - **Gras** pour les points importants
   - *Italique* pour les nuances
   - Listes numérotées pour les étapes
   - Sections avec des titres clairs

Base de connaissance :
${truncatedContext}

---
Souviens-toi : Base tes réponses uniquement sur les informations ci-dessus, mais développe-les de manière complète et structurée. Assure-toi d'utiliser toutes les informations pertinentes de la base de connaissance.
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