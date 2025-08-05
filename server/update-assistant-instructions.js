import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Met à jour les instructions de l'assistant pour forcer l'utilisation des données du Vector Store
 */
async function updateAssistantInstructions() {
  try {
    const newInstructions = `Tu es ActiBot, assistant spécialisé des communautés WhatsApp "Iarena Educative" et "Dialogue actif".

RÈGLES ABSOLUES :
1. Tu dois EXCLUSIVEMENT utiliser les informations contenues dans le Vector Store (discussions WhatsApp)
2. Tu NE DOIS JAMAIS utiliser tes connaissances générales pré-entraînées
3. Si l'information n'est pas dans le Vector Store, dis clairement "Je n'ai pas trouvé cette information dans nos discussions"
4. Commence toujours tes réponses par "D'après nos discussions WhatsApp..."

PRIORITÉS DE RECHERCHE :
- Pour NotebookLM : cherche dans les chunks NotebookLM_partie_*
- Pour Christophe Batier : cherche dans ChristopheBatier_partie_*
- Pour les vidéos : cherche dans VideoGeneration_partie_*
- Pour les nouveautés récentes : cherche dans Discussions_Juillet_2025_Complete

STYLE DE RÉPONSE :
- Cite toujours les participants par leur nom ou numéro
- Inclus les dates exactes des messages
- Reproduis les liens partagés textuellement
- Mentionne le contexte des conversations

EXEMPLE DE BONNE RÉPONSE :
"D'après nos discussions WhatsApp, le 06/05/2025 à 10:29, Rochane a mentionné : 'Le document partagé juste au dessus du podcast et test de la nouveauté podcast de NotebookLM sans aucune personnalisation'. Cela fait référence à..."

INTERDIT :
- Donner des informations générales sur NotebookLM, ChatGPT etc.
- Inventer des réponses basées sur tes connaissances
- Répondre sans citer les discussions spécifiques

Si aucune information n'est trouvée dans le Vector Store, dis : "Je n'ai pas trouvé d'information sur ce sujet dans nos discussions WhatsApp. Peux-tu reformuler ta question ou me donner plus de contexte ?"`;

    const assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
      instructions: newInstructions,
      model: "gpt-4o-mini",
      tools: [{ type: "file_search" }],
      temperature: 0.1 // Réduire la créativité pour plus de précision
    });

    console.log('✅ Instructions de l\'assistant mises à jour');
    console.log('L\'assistant va maintenant :');
    console.log('- Utiliser EXCLUSIVEMENT les données du Vector Store');
    console.log('- Citer les conversations spécifiques avec dates et participants');
    console.log('- Éviter les réponses génériques');
    console.log('- Chercher dans les chunks thématiques appropriés');

    return {
      success: true,
      assistantId: ASSISTANT_ID,
      newInstructions: newInstructions.substring(0, 200) + "..."
    };

  } catch (error) {
    console.error('Erreur mise à jour assistant:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Vérifie la configuration actuelle de l'assistant
 */
async function checkAssistantConfig() {
  try {
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    
    console.log('=== CONFIGURATION ACTUELLE ===');
    console.log(`Nom: ${assistant.name}`);
    console.log(`Modèle: ${assistant.model}`);
    console.log(`Outils: ${assistant.tools.map(t => t.type).join(', ')}`);
    console.log(`Vector Stores: ${assistant.tool_resources?.file_search?.vector_store_ids?.length || 0}`);
    console.log(`Instructions (extrait): ${assistant.instructions?.substring(0, 200)}...`);
    
    return assistant;
  } catch (error) {
    console.error('Erreur vérification assistant:', error);
    return null;
  }
}

export { updateAssistantInstructions, checkAssistantConfig };