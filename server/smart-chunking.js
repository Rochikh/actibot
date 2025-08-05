import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Crée des chunks thématiques intelligents basés sur les sujets-clés
 */
function createSmartChunks(content) {
  const lines = content.split('\n');
  const chunks = [];
  
  // Thèmes à détecter
  const themes = {
    'NotebookLM': /notebooklm|notebook lm/i,
    'ChristopheBatier': /christophe.*batier|batier.*christophe/i,
    'VideoGeneration': /vidéo|video|génér.*vidéo|création.*vidéo/i,
    'IATools': /chatgpt|claude|midjourney|dall.?e|stable.?diffusion|gpt.?4|openai/i,
    'Podcasts': /podcast|audio|son|enregistrement/i,
    'Education': /enseignant|étudiant|université|formation|pédagogie/i,
    'RecentDiscussions': /07\/2025|06\/2025|05\/2025/ // Discussions récentes
  };
  
  // Pour chaque thème, créer des chunks dédiés
  Object.entries(themes).forEach(([themeName, pattern]) => {
    const themeLines = [];
    let currentContext = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (pattern.test(line)) {
        // Ajouter le contexte (lignes précédentes et suivantes)
        const contextStart = Math.max(0, i - 5);
        const contextEnd = Math.min(lines.length, i + 10);
        const context = lines.slice(contextStart, contextEnd);
        
        themeLines.push(...context);
        themeLines.push('---'); // Séparateur
      }
    }
    
    if (themeLines.length > 100) {
      // Diviser en sous-chunks si trop volumineux
      const subChunks = [];
      for (let i = 0; i < themeLines.length; i += 3000) {
        const subChunk = themeLines.slice(i, i + 3000);
        subChunks.push(subChunk.join('\n'));
      }
      
      subChunks.forEach((subChunk, index) => {
        chunks.push({
          title: `${themeName}_partie_${index + 1}`,
          content: subChunk,
          theme: themeName,
          lines: subChunk.split('\n').length
        });
      });
    }
  });
  
  // Chunk spécial pour les discussions très récentes (juillet 2025)
  const recentLines = [];
  let inJuly2025 = false;
  
  for (const line of lines) {
    if (line.includes('01/07/2025')) {
      inJuly2025 = true;
    }
    
    if (inJuly2025) {
      recentLines.push(line);
    }
    
    // Arrêter si on sort de juillet ou si chunk trop gros
    if (inJuly2025 && recentLines.length > 4000) {
      break;
    }
  }
  
  if (recentLines.length > 0) {
    chunks.push({
      title: 'Discussions_Juillet_2025_Complete',
      content: recentLines.join('\n'),
      theme: 'Recent',
      lines: recentLines.length
    });
  }
  
  return chunks;
}

/**
 * Crée un Vector Store avec chunks intelligents
 */
async function createSmartVectorStore() {
  try {
    const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    const content = fs.readFileSync(whatsappFile, 'utf-8');
    
    console.log('=== CRÉATION CHUNKS INTELLIGENTS ===');
    const chunks = createSmartChunks(content);
    
    console.log(`Chunks thématiques créés: ${chunks.length}`);
    chunks.forEach(chunk => {
      console.log(`- ${chunk.title}: ${chunk.lines} lignes (thème: ${chunk.theme})`);
    });
    
    // Créer Vector Store
    const vectorStore = await openai.beta.vectorStores.create({
      name: "ActiBot Chunks Intelligents",
      expires_after: {
        anchor: "last_active_at", 
        days: 30
      }
    });
    
    console.log(`\nVector Store créé: ${vectorStore.id}`);
    
    // Upload des chunks
    const uploadPromises = chunks.map(async (chunk, index) => {
      const fileName = `smart_${chunk.title}_${index + 1}.txt`;
      
      try {
        const fileBuffer = Buffer.from(chunk.content, 'utf-8');
        
        const file = await openai.files.create({
          file: new File([fileBuffer], fileName, { type: 'text/plain' }),
          purpose: 'assistants'
        });
        
        await openai.beta.vectorStores.files.create(vectorStore.id, {
          file_id: file.id
        });
        
        console.log(`✓ ${chunk.title} uploadé`);
        return { success: true, chunk: chunk.title };
      } catch (error) {
        console.error(`✗ Erreur upload ${chunk.title}:`, error.message);
        return { success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successful = results.filter(r => r.success).length;
    
    // Mettre à jour l'assistant
    await openai.beta.assistants.update(ASSISTANT_ID, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id]
        }
      }
    });
    
    console.log(`\n=== RÉSUMÉ CHUNKS INTELLIGENTS ===`);
    console.log(`Vector Store ID: ${vectorStore.id}`);
    console.log(`Chunks uploadés: ${successful}/${chunks.length}`);
    console.log(`Assistant mis à jour avec chunks thématiques`);
    
    return {
      success: true,
      vectorStoreId: vectorStore.id,
      chunksUploaded: successful,
      totalChunks: chunks.length
    };
    
  } catch (error) {
    console.error('Erreur création chunks intelligents:', error);
    return { success: false, error: error.message };
  }
}

export { createSmartVectorStore, createSmartChunks };