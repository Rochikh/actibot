import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Crée un chunk spécialisé pour la conversation NotebookLM vidéo du 30/04/2025
 */
async function createSpecificVideoChunk() {
  try {
    const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    const content = fs.readFileSync(whatsappFile, 'utf-8');
    
    // Extraire spécifiquement la conversation du 30/04/2025 sur NotebookLM vidéo
    const lines = content.split('\n');
    
    // Trouver la conversation spécifique (lignes 24440-24470 environ)
    const specificConversation = [];
    let inTargetConversation = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Démarrer la capture à partir du 30/04/2025
      if (line.includes('30/04/2025, 08:43 - Laurent The Cure: bonjour à vous. Je profite de cette "nouvelle" fonctionnalité NotebookLM')) {
        inTargetConversation = true;
        // Ajouter quelques lignes de contexte avant
        for (let j = Math.max(0, i - 5); j <= i; j++) {
          specificConversation.push(lines[j]);
        }
        continue;
      }
      
      if (inTargetConversation) {
        specificConversation.push(line);
        
        // Arrêter après la confirmation de Laurent The Cure
        if (line.includes('Laurent The Cure: j\'ai adopté (et payé) Heygen. Cela répond absolument à mon besoin !')) {
          // Ajouter quelques lignes après pour le contexte
          for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
            specificConversation.push(lines[j]);
          }
          break;
        }
        
        // Sécurité : arrêter si on sort du 30/04/2025
        if (!line.includes('30/04/2025') && line.includes('/2025')) {
          break;
        }
      }
    }
    
    const chunkContent = `=== CONVERSATION SPÉCIALISÉE: NOTEBOOKLM ET GÉNÉRATION VIDÉO ===
Date: 30 avril 2025
Sujet: Comment transformer les podcasts NotebookLM en vidéos

CONTEXTE:
Cette conversation répond à la question "Peut-on générer des vidéos avec NotebookLM ?"

CONVERSATION COMPLÈTE:
${specificConversation.join('\n')}

=== RÉSUMÉ DE LA SOLUTION ===
QUESTION: Laurent The Cure demande s'il est possible d'animer les podcasts NotebookLM
RÉPONSE: +33 6 03 06 04 34 recommande:
1. Hedra (bon lipsync des podcasters)  
2. HeyGen (encore mieux)
RÉSULTAT: Laurent adopte HeyGen et confirme que "Cela répond absolument à mon besoin !"

=== MOTS-CLÉS ===
NotebookLM, podcast, vidéo, animation, HeyGen, Hedra, lipsync, Laurent The Cure`;

    console.log('=== CHUNK SPÉCIALISÉ NOTEBOOKLM VIDÉO ===');
    console.log(`Contenu capturé: ${specificConversation.length} lignes`);
    console.log(`Taille du chunk: ${chunkContent.length} caractères`);
    
    // Créer le fichier spécialisé
    const fileBuffer = Buffer.from(chunkContent, 'utf-8');
    
    const file = await openai.files.create({
      file: new File([fileBuffer], 'NotebookLM_Video_Conversation_30042025.txt', { type: 'text/plain' }),
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
      
      console.log('✅ Chunk spécialisé créé et ajouté au Vector Store');
      console.log(`File ID: ${file.id}`);
      console.log(`Vector Store: ${vectorStoreId}`);
      
      // Afficher un extrait de la conversation
      console.log('\n=== EXTRAIT DE LA CONVERSATION ===');
      specificConversation.slice(0, 10).forEach(line => {
        console.log(line);
      });
      
      return {
        success: true,
        fileId: file.id,
        vectorStoreId: vectorStoreId,
        conversationLines: specificConversation.length
      };
    } else {
      throw new Error('Vector Store non trouvé');
    }
    
  } catch (error) {
    console.error('Erreur création chunk spécialisé:', error);
    return { success: false, error: error.message };
  }
}

export { createSpecificVideoChunk };