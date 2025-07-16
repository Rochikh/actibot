import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

async function splitAndUploadWhatsAppFile() {
  try {
    console.log('🔄 Division et réindexation du fichier WhatsApp...\n');
    
    // Lire le fichier complet
    const filePath = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    console.log(`📄 Fichier original : ${lines.length} lignes`);
    
    // Diviser par périodes (ex: par mois)
    const chunks = [];
    let currentChunk = [];
    let currentDate = null;
    let chunkIndex = 0;
    
    for (const line of lines) {
      // Détecter les dates au format DD/MM/YYYY
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
      
      if (dateMatch) {
        const lineDate = dateMatch[1];
        const [day, month, year] = lineDate.split('/');
        const monthYear = `${month}/${year}`;
        
        // Si nouvelle période et chunk actuel non vide
        if (currentDate && currentDate !== monthYear && currentChunk.length > 0) {
          chunks.push({
            title: `Discussion WhatsApp ${currentDate}`,
            content: currentChunk.join('\n'),
            lines: currentChunk.length
          });
          currentChunk = [];
          chunkIndex++;
        }
        
        currentDate = monthYear;
      }
      
      currentChunk.push(line);
      
      // Limiter la taille des chunks (max 10000 lignes)
      if (currentChunk.length >= 10000) {
        chunks.push({
          title: `Discussion WhatsApp ${currentDate} (partie ${chunkIndex + 1})`,
          content: currentChunk.join('\n'),
          lines: currentChunk.length
        });
        currentChunk = [];
        chunkIndex++;
      }
    }
    
    // Ajouter le dernier chunk
    if (currentChunk.length > 0) {
      chunks.push({
        title: `Discussion WhatsApp ${currentDate}`,
        content: currentChunk.join('\n'),
        lines: currentChunk.length
      });
    }
    
    console.log(`📦 Fichier divisé en ${chunks.length} chunks`);
    
    // Récupérer l'assistant pour avoir le vector store
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    let vectorStoreId = null;
    
    if (assistant.tool_resources && assistant.tool_resources.file_search) {
      vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
    }
    
    if (!vectorStoreId) {
      console.log('❌ Pas de vector store trouvé');
      return;
    }
    
    console.log(`📁 Vector Store ID: ${vectorStoreId}`);
    
    // Uploader les chunks
    const uploadedFiles = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`⬆️ Upload chunk ${i + 1}/${chunks.length}: ${chunk.title} (${chunk.lines} lignes)`);
      
      // Sauvegarder temporairement le chunk
      const tempFile = `temp_chunk_${i}.txt`;
      fs.writeFileSync(tempFile, chunk.content);
      
      try {
        // Uploader le fichier
        const file = await openai.files.create({
          file: fs.createReadStream(tempFile),
          purpose: 'assistants'
        });
        
        // Ajouter au vector store
        await openai.beta.vectorStores.files.create(vectorStoreId, {
          file_id: file.id
        });
        
        uploadedFiles.push({
          id: file.id,
          title: chunk.title,
          lines: chunk.lines
        });
        
        console.log(`✅ Chunk ${i + 1} uploadé: ${file.id}`);
        
        // Nettoyer le fichier temporaire
        fs.unlinkSync(tempFile);
        
      } catch (error) {
        console.error(`❌ Erreur upload chunk ${i + 1}:`, error.message);
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
    
    console.log(`\n✅ Upload terminé: ${uploadedFiles.length} fichiers uploadés`);
    uploadedFiles.forEach(file => {
      console.log(`- ${file.title}: ${file.id} (${file.lines} lignes)`);
    });
    
    // Test rapide
    console.log('\n🧪 Test rapide après réindexation...');
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "François Bocquet a-t-il parlé des Gems en juillet 2025 ?"
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Attendre la réponse (timeout plus court)
    let status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    while (status.status !== 'completed' && attempts < 30) {
      if (status.status === 'failed' || status.status === 'cancelled') {
        console.log(`❌ Test échoué: ${status.status}`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }
    
    if (status.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0].text.value;
      console.log('✅ Réponse après réindexation:');
      console.log(response.substring(0, 500) + '...');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

splitAndUploadWhatsAppFile();