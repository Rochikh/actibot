import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

async function checkAssistant() {
  try {
    console.log('🔍 Vérification de l\'assistant OpenAI...\n');
    
    // Récupérer les détails de l'assistant
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    
    console.log('📋 Détails de l\'assistant :');
    console.log(`- Nom: ${assistant.name}`);
    console.log(`- Modèle: ${assistant.model}`);
    console.log(`- Outils: ${assistant.tools.map(t => t.type).join(', ')}`);
    
    // Vérifier les vector stores
    if (assistant.tool_resources && assistant.tool_resources.file_search) {
      console.log('\n📁 Vector Stores attachés :');
      const vectorStoreIds = assistant.tool_resources.file_search.vector_store_ids;
      
      if (vectorStoreIds && vectorStoreIds.length > 0) {
        for (const vsId of vectorStoreIds) {
          const vectorStore = await openai.beta.vectorStores.retrieve(vsId);
          console.log(`- Vector Store: ${vectorStore.name} (${vectorStore.file_counts.total} fichiers)`);
          
          // Lister les fichiers dans ce vector store
          const files = await openai.beta.vectorStores.files.list(vsId);
          console.log('  Fichiers:');
          for (const file of files.data) {
            const fileDetails = await openai.files.retrieve(file.id);
            console.log(`    - ${fileDetails.filename} (${fileDetails.bytes} bytes, créé: ${new Date(fileDetails.created_at * 1000).toLocaleString()})`);
          }
        }
      } else {
        console.log('❌ Aucun Vector Store attaché !');
      }
    } else {
      console.log('❌ File Search non configuré !');
    }
    
    // Test rapide avec une question
    console.log('\n🧪 Test rapide avec une question...');
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Parle-moi de François Bocquet et les Gems en juillet 2025"
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Attendre la réponse
    let status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    while (status.status !== 'completed' && attempts < 30) {
      if (status.status === 'failed' || status.status === 'cancelled') {
        console.log(`❌ Test échoué: ${status.status}`);
        console.log('Erreur:', status.last_error);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }
    
    if (status.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0].text.value;
      console.log('✅ Réponse reçue:');
      console.log(response.substring(0, 200) + '...');
      
      // Vérifier si la réponse contient des informations pertinentes
      if (response.toLowerCase().includes('françois bocquet') || response.toLowerCase().includes('gems')) {
        console.log('✅ L\'assistant trouve les informations !');
      } else {
        console.log('❌ L\'assistant ne trouve pas les informations spécifiques');
      }
    } else {
      console.log(`❌ Timeout - Status: ${status.status}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkAssistant();