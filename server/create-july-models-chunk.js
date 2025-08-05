import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Crée un chunk spécialisé pour les discussions sur les modèles de juillet 2025
 */
async function createJulyModelsChunk() {
  try {
    const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    const content = fs.readFileSync(whatsappFile, 'utf-8');
    
    const lines = content.split('\n');
    const julyModelsContent = [];
    
    // Extraire spécifiquement les discussions sur les modèles en juillet 2025
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Si c'est une ligne de juillet ET qu'elle mentionne des modèles/IA
      if (line.includes('/07/2025') && 
          (line.toLowerCase().includes('modèle') || 
           line.toLowerCase().includes('model') ||
           line.toLowerCase().includes('mistral') ||
           line.toLowerCase().includes('gemini') ||
           line.toLowerCase().includes('claude') ||
           line.toLowerCase().includes('deepseek') ||
           line.toLowerCase().includes('google') ||
           line.toLowerCase().includes('gpt') ||
           line.toLowerCase().includes('llama') ||
           line.toLowerCase().includes('n3') ||
           line.toLowerCase().includes('r1') ||
           line.toLowerCase().includes('ollama') ||
           line.toLowerCase().includes('suisse') ||
           line.toLowerCase().includes('swiss'))) {
        
        // Ajouter le contexte autour
        const contextStart = Math.max(0, i - 8);
        const contextEnd = Math.min(lines.length, i + 8);
        const context = lines.slice(contextStart, contextEnd);
        
        julyModelsContent.push('=== DISCUSSION MODÈLES JUILLET 2025 ===');
        julyModelsContent.push(...context);
        julyModelsContent.push('');
      }
    }
    
    // Ajouter spécifiquement la discussion du 13/07/2025 sur les modèles Google N3 et DeepSeek R1
    const specificDiscussion = `
=== DISCUSSION SPÉCIALISÉE: NOUVEAUX MODÈLES JUILLET 2025 ===
Date: 13 juillet 2025
Participants: +32 483 60 53 96, Jean-Marc Everard, +33 6 66 98 84 23

CONTEXTE: Discussion sur les modèles recommandés pour les institutions

CONVERSATION:
13/07/2025, 11:53 - +32 483 60 53 96: Le mieux est de déployer un modèle au niveau de l'institution ou partagée entre les institutions pour un public précis (exemple chercheurs ou administration) : comme par exemple un modele petit ollama ou modele Mistral small recent ; ya aussi le modèle Google N3 qui recemment est intéressant à utiliser en local ; sinon un modèle de raisonnement deepseek R1 en local est un bon choix parfois en local (cest ce que j'ai vu de plus utilisé dans les universités)

13/07/2025, 16:46 - Jean-Marc Everard: Merci Robin. Quand j'essaye de mettre en place des systèmes et modèles locaux, les informaticiens m'opposent souvent la difficulté du suivi, des mises à jours des « containers » ou appli, des modèles, la mise en place d'une mémoire etc… est-ce que tu as déjà été confronté à cela et envisagé des modes opératoires par rapport à ça?

13/07/2025, 17:54 - +33 6 66 98 84 23: Bonjour, il me semble qu'il était possible de louer un serveur sur lequel on pouvait déployer une IA (comme en local) et là il n'y avait pas de pb de puissance ?

MODÈLES MENTIONNÉS:
- Google N3 (récemment intéressant en local)
- DeepSeek R1 (modèle de raisonnement, très utilisé dans les universités)
- Mistral Small (version récente)
- Ollama (modèle petit pour institutions)

MOTS-CLÉS: Google N3, DeepSeek R1, Mistral, Ollama, juillet 2025, modèles récents, institutions, universités
`;

    const finalContent = julyModelsContent.join('\n') + specificDiscussion;
    
    console.log('=== CHUNK MODÈLES JUILLET 2025 ===');
    console.log(`Contenu capturé: ${julyModelsContent.length} lignes`);
    console.log(`Taille totale: ${finalContent.length} caractères`);
    
    // Créer le fichier spécialisé
    const fileBuffer = Buffer.from(finalContent, 'utf-8');
    
    const file = await openai.files.create({
      file: new File([fileBuffer], 'July2025_AI_Models_Discussion.txt', { type: 'text/plain' }),
      purpose: 'assistants'
    });
    
    // Récupérer le Vector Store actuel
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    const vectorStoreId = assistant.tool_resources?.file_search?.vector_store_ids?.[0];
    
    if (vectorStoreId) {
      // Ajouter le fichier au Vector Store
      await openai.beta.vectorStores.files.create(vectorStoreId, {
        file_id: file.id
      });
      
      console.log('✅ Chunk modèles juillet 2025 créé et ajouté');
      console.log(`File ID: ${file.id}`);
      console.log(`Vector Store: ${vectorStoreId}`);
      
      console.log('\n=== MODÈLES IDENTIFIÉS EN JUILLET ===');
      console.log('- Google N3 (récemment intéressant)');
      console.log('- DeepSeek R1 (raisonnement, universités)');
      console.log('- Mistral Small (version récente)');
      console.log('- Ollama (pour institutions)');
      
      return {
        success: true,
        fileId: file.id,
        vectorStoreId: vectorStoreId,
        contentLines: julyModelsContent.length
      };
    } else {
      throw new Error('Vector Store non trouvé');
    }
    
  } catch (error) {
    console.error('Erreur création chunk juillet:', error);
    return { success: false, error: error.message };
  }
}

export { createJulyModelsChunk };