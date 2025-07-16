import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

async function testSpecificSearch() {
  try {
    console.log('🔍 Test de recherche spécifique...\n');
    
    // Test avec instruction très précise
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Recherche dans TOUT le fichier "Discussion WhatsApp" les mentions exactes de "Francois Bocquet" ET "Gems" pour juillet 2025. 
      
      IMPORTANT : Parcours l'intégralité du fichier, pas seulement les premiers résultats. 
      
      Cherche spécifiquement :
      - Date : 16/07/2025 
      - Auteur : Francois Bocquet
      - Sujet : Gems personnalisés
      - Ligne approximative : 27050-27051
      
      Fournis le texte EXACT trouvé avec la date et l'heure précises.`
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Attendre la réponse
    let status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    while (status.status !== 'completed' && attempts < 60) {
      if (status.status === 'failed' || status.status === 'cancelled') {
        console.log(`❌ Test échoué: ${status.status}`);
        console.log('Erreur:', status.last_error);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
      console.log(`Status: ${status.status} (${attempts}/60)`);
    }
    
    if (status.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0].text.value;
      console.log('✅ Réponse détaillée:');
      console.log(response);
      
      // Vérifier si la réponse contient les bonnes informations
      if (response.includes('16/07/2025') && response.includes('00:39')) {
        console.log('\n✅ L\'assistant a trouvé la bonne information !');
      } else {
        console.log('\n❌ L\'assistant n\'a pas trouvé la bonne information');
      }
    } else {
      console.log(`❌ Timeout - Status: ${status.status}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSpecificSearch();