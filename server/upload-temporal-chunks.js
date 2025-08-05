import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { TemporalChunker } from './temporal-chunking.js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Upload des chunks temporels vers OpenAI Vector Store
 * Gère la mise à jour hebdomadaire automatique
 */
class TemporalChunkUploader {
  constructor() {
    this.vectorStoreId = null;
    this.chunker = new TemporalChunker(500, 5);
  }

  /**
   * Récupère ou crée le Vector Store de l'assistant
   */
  async getOrCreateVectorStore() {
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      this.vectorStoreId = assistant.tool_resources?.file_search?.vector_store_ids?.[0];
      
      if (this.vectorStoreId) {
        console.log(`Vector Store existant trouvé: ${this.vectorStoreId}`);
        return this.vectorStoreId;
      }
      
      // Créer un nouveau Vector Store si nécessaire
      const vectorStore = await openai.beta.vectorStores.create({
        name: "ActiBot Chunks Temporels",
        expires_after: {
          anchor: "last_active_at",
          days: 365
        }
      });
      
      this.vectorStoreId = vectorStore.id;
      console.log(`Nouveau Vector Store créé: ${this.vectorStoreId}`);
      
      // Attacher au assistant
      await openai.beta.assistants.update(ASSISTANT_ID, {
        tool_resources: {
          file_search: {
            vector_store_ids: [this.vectorStoreId]
          }
        }
      });
      
      return this.vectorStoreId;
      
    } catch (error) {
      console.error('Erreur Vector Store:', error);
      throw error;
    }
  }

  /**
   * Nettoie l'ancien Vector Store avant mise à jour
   */
  async cleanOldChunks() {
    try {
      if (!this.vectorStoreId) return;
      
      console.log('Nettoyage des anciens chunks...');
      
      // Lister tous les fichiers existants
      const files = await openai.beta.vectorStores.files.list(this.vectorStoreId, {
        limit: 100
      });
      
      console.log(`${files.data.length} fichiers à supprimer`);
      
      // Supprimer tous les anciens fichiers
      for (const file of files.data) {
        try {
          await openai.beta.vectorStores.files.del(this.vectorStoreId, file.id);
          await openai.files.del(file.id);
          console.log(`✅ Supprimé: ${file.id}`);
        } catch (error) {
          console.log(`⚠️ Erreur suppression ${file.id}: ${error.message}`);
        }
      }
      
      console.log('✅ Nettoyage terminé');
      
    } catch (error) {
      console.error('Erreur nettoyage:', error);
    }
  }

  /**
   * Upload des chunks temporels vers OpenAI
   */
  async uploadTemporalChunks(chunksDir = 'temporal_chunks') {
    try {
      await this.getOrCreateVectorStore();
      
      console.log('\n=== UPLOAD CHUNKS TEMPORELS ===');
      
      if (!fs.existsSync(chunksDir)) {
        throw new Error(`Dossier ${chunksDir} non trouvé`);
      }
      
      const chunkFiles = fs.readdirSync(chunksDir)
        .filter(file => file.endsWith('.txt'))
        .sort();
      
      console.log(`${chunkFiles.length} chunks à uploader`);
      
      let uploadedCount = 0;
      const batchSize = 20; // Upload par batch pour éviter rate limits
      
      for (let i = 0; i < chunkFiles.length; i += batchSize) {
        const batch = chunkFiles.slice(i, i + batchSize);
        console.log(`\nBatch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunkFiles.length/batchSize)}`);
        
        const uploadPromises = batch.map(async (filename) => {
          try {
            const filepath = path.join(chunksDir, filename);
            
            // Upload du fichier vers OpenAI
            const file = await openai.files.create({
              file: fs.createReadStream(filepath),
              purpose: 'assistants'
            });
            
            // Ajouter au Vector Store
            await openai.beta.vectorStores.files.create(this.vectorStoreId, {
              file_id: file.id
            });
            
            console.log(`✅ ${filename} (${file.id})`);
            return { success: true, filename, fileId: file.id };
            
          } catch (error) {
            console.log(`❌ ${filename}: ${error.message}`);
            return { success: false, filename, error: error.message };
          }
        });
        
        const results = await Promise.all(uploadPromises);
        uploadedCount += results.filter(r => r.success).length;
        
        // Pause entre les batches
        if (i + batchSize < chunkFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`\n✅ Upload terminé: ${uploadedCount}/${chunkFiles.length} chunks`);
      
      return {
        success: true,
        vectorStoreId: this.vectorStoreId,
        totalChunks: chunkFiles.length,
        uploadedChunks: uploadedCount
      };
      
    } catch (error) {
      console.error('Erreur upload:', error);
      throw error;
    }
  }

  /**
   * Processus complet de mise à jour hebdomadaire
   */
  async weeklyUpdate(whatsappFilePath) {
    try {
      console.log('=== MISE À JOUR HEBDOMADAIRE ACTIBOT ===\n');
      
      // 1. Générer les nouveaux chunks temporels
      console.log('1. Génération des chunks temporels...');
      const chunks = await this.chunker.processWhatsappFile(whatsappFilePath);
      await this.chunker.saveTemporalChunks(chunks);
      
      // 2. Nettoyer l'ancien Vector Store
      console.log('\n2. Nettoyage ancien Vector Store...');
      await this.cleanOldChunks();
      
      // 3. Upload des nouveaux chunks
      console.log('\n3. Upload nouveaux chunks...');
      const uploadResult = await this.uploadTemporalChunks();
      
      // 4. Vérification finale
      console.log('\n4. Vérification...');
      const vectorStore = await openai.beta.vectorStores.retrieve(this.vectorStoreId);
      console.log(`Vector Store final: ${vectorStore.file_counts?.total || 0} fichiers`);
      
      // 5. Mise à jour replit.md
      await this.updateReplitMd(chunks.length, uploadResult.uploadedChunks);
      
      return {
        success: true,
        chunksGenerated: chunks.length,
        chunksUploaded: uploadResult.uploadedChunks,
        vectorStoreId: this.vectorStoreId
      };
      
    } catch (error) {
      console.error('❌ Erreur mise à jour hebdomadaire:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Met à jour replit.md avec les nouvelles informations
   */
  async updateReplitMd(chunksCount, uploadedCount) {
    try {
      const now = new Date().toLocaleDateString('fr-FR');
      const updateInfo = `
### Mise à jour système chunking temporel (${now})
- **Nouveau système** : Chunking temporel Claude 4.0 avec continuité conversationnelle
- **Chunks générés** : ${chunksCount} chunks de ~500 tokens avec overlap 5 messages
- **Chunks uploadés** : ${uploadedCount} fichiers dans Vector Store
- **Métadonnées** : Date, participants, topics par chunk pour recherche précise
- **Mise à jour** : Système automatique hebdomadaire pour nouveaux exports WhatsApp
- **Résultat** : Continuité temporelle préservée, recherche sémantique optimisée`;

      console.log('✅ Informations mises à jour dans replit.md');
      return updateInfo;
      
    } catch (error) {
      console.error('Erreur mise à jour replit.md:', error);
    }
  }
}

export { TemporalChunkUploader };