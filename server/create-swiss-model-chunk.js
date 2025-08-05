import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Crée un chunk spécialisé pour la découverte du modèle IA suisse de juillet 2025
 */
async function createSwissModelChunk() {
  try {
    const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    const content = fs.readFileSync(whatsappFile, 'utf-8');
    
    const lines = content.split('\n');
    
    // Trouver la ligne 27384 et extraire le contexte
    const targetLine = 27384 - 1; // Index 0-based
    const contextStart = Math.max(0, targetLine - 10);
    const contextEnd = Math.min(lines.length, targetLine + 20);
    const context = lines.slice(contextStart, contextEnd);
    
    const swissModelContent = `=== DÉCOUVERTE MAJEURE: MODÈLE IA SUISSE JUILLET 2025 ===
Date: 27 juillet 2025, 19:41
Participant: Rochane
Source: Courrier International

LIEN PARTAGÉ:
https://www.courrierinternational.com/article/recherche-la-suisse-invente-un-modele-pour-l-ia-plus-ouvert-et-universel-qu-aucun-autre_233303

DESCRIPTION COMPLÈTE:
La Suisse vient de franchir une étape majeure dans le domaine de l'intelligence artificielle en lançant un modèle IA à la fois plus ouvert et plus universel que ceux proposés par les géants mondiaux actuels. 

INSTITUTIONS IMPLIQUÉES:
- École polytechnique fédérale de Lausanne (EPFL)
- École polytechnique fédérale de Zurich (ETHZ)
- Autres institutions de recherche suisses

INFRASTRUCTURE:
- Supercalculateur "Alps" à Lugano
- Plus de 10,000 processeurs graphiques (GPU) Nvidia
- Puissance pour entraîner des modèles de très grande ampleur

CARACTÉRISTIQUES RÉVOLUTIONNAIRES:
1. Open source complet (contrairement à Llama, Deepseek)
2. Transparence totale:
   - Publication des poids du modèle
   - Ensemble des données d'entraînement publiques
   - Descriptions détaillées des données
   - Méthodes d'entraînement complètes
3. Traçabilité complète
4. Respect critères éthiques et juridiques
5. Exclusion des données personnelles
6. Contrôle qualité et provenance des données

CONTEXTE WHATSAPP:
${context.join('\n')}

=== MOTS-CLÉS ===
Suisse, EPFL, ETHZ, Alps, supercalculateur, Lugano, Nvidia, modèle IA, open source, juillet 2025, Rochane, Courrier International, transparence, éthique

=== QUESTION TYPES À RÉPONDRE ===
- "Nouveau modèle suisse juillet 2025"
- "EPFL ETHZ modèle IA"
- "Supercalculateur Alps"
- "Modèle IA open source complet"
- "Rochane partage modèle suisse"`;

    console.log('=== CHUNK MODÈLE SUISSE SPÉCIALISÉ ===');
    console.log(`Contenu: ligne ${targetLine + 1} (27384)`);
    console.log(`Taille: ${swissModelContent.length} caractères`);
    
    // Créer le fichier spécialisé
    const fileBuffer = Buffer.from(swissModelContent, 'utf-8');
    
    const file = await openai.files.create({
      file: new File([fileBuffer], 'Swiss_AI_Model_July27_2025_Rochane.txt', { type: 'text/plain' }),
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
      
      console.log('✅ Chunk modèle suisse créé et ajouté');
      console.log(`File ID: ${file.id}`);
      console.log(`Date précise: 27/07/2025, 19:41`);
      console.log(`Participant: Rochane`);
      console.log(`Sujet: EPFL/ETHZ + supercalculateur Alps`);
      
      return {
        success: true,
        fileId: file.id,
        vectorStoreId: vectorStoreId,
        date: '27/07/2025, 19:41',
        participant: 'Rochane'
      };
    } else {
      throw new Error('Vector Store non trouvé');
    }
    
  } catch (error) {
    console.error('Erreur création chunk modèle suisse:', error);
    return { success: false, error: error.message };
  }
}

export { createSwissModelChunk };