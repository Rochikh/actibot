import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Extrait seulement les données récentes (2025) du fichier WhatsApp
 */
function extractRecentData(content, startYear = 2025) {
  const lines = content.split('\n');
  const recentLines = [];
  let foundRecentData = false;
  
  for (const line of lines) {
    // Détecter les dates au format DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/(\d{4}))/);
    
    if (dateMatch) {
      const year = parseInt(dateMatch[2]);
      if (year >= startYear) {
        foundRecentData = true;
      } else if (foundRecentData) {
        // Si on a trouvé des données récentes et qu'on retombe sur une année antérieure,
        // on arrête (les données WhatsApp peuvent être mélangées)
        continue;
      }
    }
    
    if (foundRecentData) {
      recentLines.push(line);
    }
  }
  
  return recentLines.join('\n');
}

/**
 * Divise les données récentes en chunks optimisés
 */
function splitRecentDataIntoChunks(content, filename) {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentMonth = null;
  
  for (const line of lines) {
    // Détecter les dates au format DD/MM/YYYY  
    const dateMatch = line.match(/^(\d{2}\/(\d{2})\/(\d{4}))/);
    
    if (dateMatch) {
      const month = dateMatch[2];
      const year = dateMatch[3];
      const monthYear = `${month}/${year}`;
      
      // Si nouveau mois et chunk actuel non vide
      if (currentMonth && currentMonth !== monthYear && currentChunk.length > 100) {
        chunks.push({
          title: `${filename} - ${getMonthName(currentMonth)} (récent)`,
          content: currentChunk.join('\n'),
          lines: currentChunk.length,
          period: currentMonth
        });
        currentChunk = [];
      }
      
      currentMonth = monthYear;
    }
    
    currentChunk.push(line);
    
    // Limiter la taille des chunks pour les données récentes (plus petits = plus précis)
    if (currentChunk.length >= 2000) {
      chunks.push({
        title: `${filename} - ${getMonthName(currentMonth)} partie ${chunks.length + 1} (récent)`,
        content: currentChunk.join('\n'),
        lines: currentChunk.length,
        period: currentMonth
      });
      currentChunk = [];
    }
  }
  
  // Ajouter le dernier chunk
  if (currentChunk.length > 0) {
    chunks.push({
      title: `${filename} - ${getMonthName(currentMonth)} final (récent)`,
      content: currentChunk.join('\n'),
      lines: currentChunk.length,
      period: currentMonth
    });
  }
  
  return chunks;
}

function getMonthName(monthYear) {
  if (!monthYear) return 'Période inconnue';
  
  const [month, year] = monthYear.split('/');
  const months = {
    '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
    '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
    '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
  };
  
  return `${months[month] || month} ${year}`;
}

/**
 * Crée un Vector Store dédié aux données récentes
 */
async function createRecentDataVectorStore(chunks) {
  try {
    console.log(`Création d'un Vector Store pour ${chunks.length} chunks récents...`);
    
    // Créer un nouveau Vector Store pour les données récentes
    const vectorStore = await openai.beta.vectorStores.create({
      name: "ActiBot Données Récentes 2025",
      expires_after: {
        anchor: "last_active_at",
        days: 30
      }
    });
    
    console.log(`Vector Store créé: ${vectorStore.id}`);
    
    // Upload des chunks récents
    const uploadPromises = chunks.map(async (chunk, index) => {
      const fileName = `chunk_recent_${index + 1}_${chunk.period?.replace('/', '-')}.txt`;
      
      try {
        // Créer un buffer pour le fichier
        const fileBuffer = Buffer.from(chunk.content, 'utf-8');
        
        const file = await openai.files.create({
          file: new File([fileBuffer], fileName, { type: 'text/plain' }),
          purpose: 'assistants'
        });
        
        await openai.beta.vectorStores.files.create(vectorStore.id, {
          file_id: file.id
        });
        
        console.log(`✓ Chunk récent ${index + 1}/${chunks.length} uploadé: ${chunk.title}`);
        return { success: true, chunk: chunk.title };
      } catch (error) {
        console.error(`✗ Erreur upload chunk ${index + 1}:`, error.message);
        return { success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successful = results.filter(r => r.success).length;
    
    console.log(`\n=== RÉSUMÉ VECTOR STORE RÉCENT ===`);
    console.log(`Vector Store ID: ${vectorStore.id}`);
    console.log(`Chunks uploadés avec succès: ${successful}/${chunks.length}`);
    
    return {
      vectorStoreId: vectorStore.id,
      chunksUploaded: successful,
      totalChunks: chunks.length,
      results
    };
    
  } catch (error) {
    console.error('Erreur création Vector Store récent:', error);
    throw error;
  }
}

/**
 * Met à jour l'assistant pour utiliser le Vector Store récent
 */
async function updateAssistantWithRecentData(vectorStoreId) {
  try {
    const assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      }
    });
    
    console.log(`✓ Assistant mis à jour avec le Vector Store récent: ${vectorStoreId}`);
    return assistant;
  } catch (error) {
    console.error('Erreur mise à jour assistant:', error);
    throw error;
  }
}

/**
 * Processus complet : extraction + division + upload des données récentes
 */
async function processRecentDataOnly() {
  try {
    const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    
    if (!fs.existsSync(whatsappFile)) {
      throw new Error("Fichier WhatsApp non trouvé");
    }
    
    console.log('=== TRAITEMENT DONNÉES RÉCENTES UNIQUEMENT ===');
    const content = fs.readFileSync(whatsappFile, 'utf-8');
    console.log(`Fichier original: ${content.length} caractères`);
    
    // Extraire seulement les données de 2025
    const recentContent = extractRecentData(content, 2025);
    console.log(`Données récentes extraites: ${recentContent.length} caractères`);
    
    if (recentContent.length < 1000) {
      throw new Error("Pas assez de données récentes trouvées");
    }
    
    // Diviser en chunks optimisés pour les données récentes
    const chunks = splitRecentDataIntoChunks(recentContent, 'WhatsApp Dialogue Actif');
    console.log(`Chunks récents créés: ${chunks.length}`);
    
    // Créer Vector Store dédié
    const result = await createRecentDataVectorStore(chunks);
    
    // Mettre à jour l'assistant
    await updateAssistantWithRecentData(result.vectorStoreId);
    
    return {
      success: true,
      message: `✅ Données récentes 2025 traitées avec succès`,
      vectorStoreId: result.vectorStoreId,
      chunksProcessed: result.chunksUploaded,
      recentDataSize: recentContent.length
    };
    
  } catch (error) {
    console.error('Erreur traitement données récentes:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export { processRecentDataOnly, extractRecentData, splitRecentDataIntoChunks };