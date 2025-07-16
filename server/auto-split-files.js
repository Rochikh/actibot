import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Détecte si un fichier doit être divisé (trop volumineux)
 */
function shouldSplitFile(content) {
  const lines = content.split('\n').length;
  const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
  
  // Diviser si plus de 5000 lignes ou plus de 1MB
  return lines > 5000 || sizeKB > 1024;
}

/**
 * Divise un fichier WhatsApp par périodes
 */
function splitWhatsAppFile(content, filename) {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentPeriod = null;
  let chunkIndex = 0;
  
  for (const line of lines) {
    // Détecter les dates au format DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    
    if (dateMatch) {
      const lineDate = dateMatch[1];
      const [day, month, year] = lineDate.split('/');
      const monthYear = `${month}/${year}`;
      
      // Si nouvelle période et chunk actuel non vide
      if (currentPeriod && currentPeriod !== monthYear && currentChunk.length > 0) {
        chunks.push({
          title: `${path.basename(filename, '.txt')} ${currentPeriod}`,
          content: currentChunk.join('\n'),
          lines: currentChunk.length
        });
        currentChunk = [];
        chunkIndex++;
      }
      
      currentPeriod = monthYear;
    }
    
    currentChunk.push(line);
    
    // Limiter la taille des chunks (max 8000 lignes)
    if (currentChunk.length >= 8000) {
      chunks.push({
        title: `${path.basename(filename, '.txt')} ${currentPeriod || 'partie'} (${chunkIndex + 1})`,
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
      title: `${path.basename(filename, '.txt')} ${currentPeriod || 'final'}`,
      content: currentChunk.join('\n'),
      lines: currentChunk.length
    });
  }
  
  return chunks;
}

/**
 * Divise un fichier texte générique par blocs
 */
function splitGenericFile(content, filename) {
  const lines = content.split('\n');
  const chunks = [];
  const chunkSize = 5000; // Lignes par chunk
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunkLines = lines.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;
    
    chunks.push({
      title: `${path.basename(filename, '.txt')} (partie ${chunkNumber})`,
      content: chunkLines.join('\n'),
      lines: chunkLines.length
    });
  }
  
  return chunks;
}

/**
 * Upload et indexe les chunks dans le Vector Store
 */
async function uploadChunks(chunks, vectorStoreId) {
  const uploadedFiles = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`⬆️ Upload chunk ${i + 1}/${chunks.length}: ${chunk.title} (${chunk.lines} lignes)`);
    
    try {
      // Créer fichier temporaire
      const tempFile = `temp_chunk_${i}_${Date.now()}.txt`;
      fs.writeFileSync(tempFile, chunk.content);
      
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
      
      // Pause pour éviter les rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Erreur upload chunk ${i + 1}:`, error.message);
    }
  }
  
  return uploadedFiles;
}

/**
 * Fonction principale d'auto-division
 */
async function autoSplitAndUpload(fileContent, filename) {
  try {
    console.log(`🔄 Analyse du fichier: ${filename}`);
    
    // Vérifier si division nécessaire
    if (!shouldSplitFile(fileContent)) {
      console.log(`✅ Fichier ${filename} assez petit, pas de division nécessaire`);
      return null;
    }
    
    console.log(`📦 Division nécessaire pour ${filename}`);
    
    // Diviser selon le type de fichier
    let chunks;
    if (filename.toLowerCase().includes('whatsapp') || filename.toLowerCase().includes('discussion')) {
      chunks = splitWhatsAppFile(fileContent, filename);
    } else {
      chunks = splitGenericFile(fileContent, filename);
    }
    
    console.log(`📊 Fichier divisé en ${chunks.length} chunks`);
    
    // Récupérer le vector store
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
    
    // Uploader les chunks
    const uploadedFiles = await uploadChunks(chunks, vectorStoreId);
    
    console.log(`✅ Division terminée: ${uploadedFiles.length} fichiers uploadés`);
    
    return {
      originalFile: filename,
      chunksCreated: uploadedFiles.length,
      uploadedFiles: uploadedFiles
    };
    
  } catch (error) {
    console.error(`❌ Erreur auto-split pour ${filename}:`, error.message);
    return null;
  }
}

// Exporter pour utilisation dans d'autres modules
export { autoSplitAndUpload, shouldSplitFile };

// Test si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test avec le fichier WhatsApp existant
  const testFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  if (fs.existsSync(testFile)) {
    const content = fs.readFileSync(testFile, 'utf-8');
    autoSplitAndUpload(content, 'Discussion WhatsApp avec Ai-Dialogue Actif.txt');
  }
}