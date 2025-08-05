import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Diagnostique le Vector Store pour comprendre pourquoi les recherches échouent
 */
async function diagnoseVectorStore() {
  try {
    console.log('=== DIAGNOSTIC VECTOR STORE ===\n');
    
    // 1. Vérifier l'assistant
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    const vectorStoreId = assistant.tool_resources?.file_search?.vector_store_ids?.[0];
    
    console.log(`Assistant: ${assistant.name}`);
    console.log(`Modèle: ${assistant.model}`);
    console.log(`Vector Store ID: ${vectorStoreId}`);
    console.log(`Instructions (extrait): ${assistant.instructions?.substring(0, 150)}...`);
    
    if (!vectorStoreId) {
      throw new Error('Aucun Vector Store attaché à l\'assistant');
    }
    
    // 2. Examiner le Vector Store
    const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
    console.log(`\n=== VECTOR STORE INFO ===`);
    console.log(`Nom: ${vectorStore.name}`);
    console.log(`Statut: ${vectorStore.status}`);
    console.log(`Fichiers: ${vectorStore.file_counts?.total || 0}`);
    console.log(`Créé: ${new Date(vectorStore.created_at * 1000).toLocaleString()}`);
    
    // 3. Lister les fichiers
    const files = await openai.beta.vectorStores.files.list(vectorStoreId, {
      limit: 100
    });
    
    console.log(`\n=== FICHIERS DANS LE VECTOR STORE ===`);
    console.log(`Total: ${files.data.length} fichiers`);
    
    for (const file of files.data.slice(0, 20)) {
      try {
        const fileDetails = await openai.files.retrieve(file.id);
        console.log(`- ${fileDetails.filename} (${Math.round(fileDetails.bytes/1024)}KB) - ${file.status}`);
      } catch (error) {
        console.log(`- ${file.id} - ERREUR: ${error.message}`);
      }
    }
    
    // 4. Test de recherche directe dans le Vector Store
    console.log(`\n=== TEST RECHERCHE SÉMANTIQUE ===`);
    
    const testQueries = [
      "modèle suisse juillet 2025",
      "Rochane modèle IA",
      "EPFL ETHZ Alps",
      "27 juillet 2025",
      "Courrier International Suisse"
    ];
    
    for (const query of testQueries) {
      try {
        // Créer un embedding pour la requête
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: query
        });
        
        console.log(`\nRequête: "${query}"`);
        console.log(`Embedding créé: ${embedding.data[0].embedding.length} dimensions`);
        
        // Note: OpenAI ne permet pas de rechercher directement dans le Vector Store
        // mais on peut voir si l'embedding se crée correctement
        
      } catch (error) {
        console.log(`Erreur recherche "${query}": ${error.message}`);
      }
    }
    
    // 5. Test avec l'assistant directement
    console.log(`\n=== TEST ASSISTANT DIRECT ===`);
    
    const thread = await openai.beta.threads.create();
    
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "En juillet 2025, quelqu'un a parlé d'un nouveau modèle suisse. Peux-tu me dire qui et quand précisément ?"
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Attendre la réponse
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    
    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0].text.value;
      
      console.log('Réponse de l\'assistant:');
      console.log(response.substring(0, 500) + '...');
      
      // Analyser si la réponse contient les bonnes informations
      const hasRochane = response.toLowerCase().includes('rochane');
      const hasJuly27 = response.includes('27/07/2025') || response.includes('27 juillet');
      const hasEPFL = response.toLowerCase().includes('epfl') || response.toLowerCase().includes('ethz');
      
      console.log(`\nAnalyse de la réponse:`);
      console.log(`- Mentionne Rochane: ${hasRochane ? '✅' : '❌'}`);
      console.log(`- Mentionne 27 juillet: ${hasJuly27 ? '✅' : '❌'}`);
      console.log(`- Mentionne EPFL/ETHZ: ${hasEPFL ? '✅' : '❌'}`);
      
    } else {
      console.log(`Erreur run: ${runStatus.status}`);
      if (runStatus.last_error) {
        console.log(`Détail: ${runStatus.last_error.message}`);
      }
    }
    
    // Nettoyer
    await openai.beta.threads.del(thread.id);
    
    return {
      success: true,
      vectorStoreId,
      filesCount: files.data.length,
      assistantModel: assistant.model
    };
    
  } catch (error) {
    console.error('Erreur diagnostic:', error);
    return { success: false, error: error.message };
  }
}

export { diagnoseVectorStore };