import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

async function quickSplit() {
  try {
    console.log('🔄 Division rapide du fichier WhatsApp...\n');
    
    // Lire le fichier
    const content = fs.readFileSync('../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt', 'utf-8');
    const lines = content.split('\n');
    
    console.log(`📄 Fichier original : ${lines.length} lignes`);
    
    // Trouver la partie avec François Bocquet et juillet 2025
    const july2025Lines = [];
    let capturing = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Détecter les dates de juillet 2025
      if (line.includes('16/07/2025') || line.includes('15/07/2025') || line.includes('17/07/2025')) {
        capturing = true;
        // Inclure un peu de contexte avant
        for (let j = Math.max(0, i - 50); j < i; j++) {
          if (!july2025Lines.includes(lines[j])) {
            july2025Lines.push(lines[j]);
          }
        }
      }
      
      if (capturing) {
        july2025Lines.push(line);
        
        // Arrêter après avoir capturé assez de contexte
        if (july2025Lines.length > 500) {
          capturing = false;
        }
      }
    }
    
    console.log(`📦 Extrait juillet 2025 : ${july2025Lines.length} lignes`);
    
    // Créer le fichier focalisé
    const july2025Content = july2025Lines.join('\n');
    fs.writeFileSync('july2025_discussion.txt', july2025Content);
    
    // Uploader ce fichier ciblé
    const file = await openai.files.create({
      file: fs.createReadStream('july2025_discussion.txt'),
      purpose: 'assistants'
    });
    
    console.log(`✅ Fichier juillet 2025 uploadé: ${file.id}`);
    
    // Récupérer le vector store et ajouter le fichier
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
    
    await openai.beta.vectorStores.files.create(vectorStoreId, {
      file_id: file.id
    });
    
    console.log(`✅ Fichier ajouté au Vector Store: ${vectorStoreId}`);
    
    // Test immédiat
    console.log('\n🧪 Test immédiat...');
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Recherche François Bocquet et les Gems en juillet 2025. Donne-moi la date et l'heure exactes avec le texte complet."
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Attendre la réponse
    let status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    while (status.status !== 'completed' && attempts < 20) {
      if (status.status === 'failed' || status.status === 'cancelled') {
        console.log(`❌ Test échoué: ${status.status}`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
      console.log(`⏳ Status: ${status.status} (${attempts}/20)`);
    }
    
    if (status.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0].text.value;
      console.log('\n✅ Réponse après optimisation:');
      console.log(response);
      
      if (response.includes('16/07/2025') && response.includes('Gems')) {
        console.log('\n🎉 SUCCÈS ! L\'assistant trouve maintenant l\'information !');
      } else {
        console.log('\n⚠️ L\'assistant ne trouve toujours pas l\'information précise');
      }
    } else {
      console.log(`❌ Timeout - Status: ${status.status}`);
    }
    
    // Nettoyer
    fs.unlinkSync('july2025_discussion.txt');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

quickSplit();