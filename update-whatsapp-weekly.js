import { TemporalChunkUploader } from './server/upload-temporal-chunks.js';

/**
 * Script de mise à jour hebdomadaire des discussions WhatsApp
 * À exécuter chaque semaine avec le nouveau fichier export
 */
async function updateWhatsAppWeekly() {
  console.log('=== MISE À JOUR ACTIBOT (FICHIER COMPLET) ===\n');
  
  try {
    const uploader = new TemporalChunkUploader();
    
    // Chemin vers le fichier WhatsApp COMPLET (anciennes + nouvelles discussions)
    const whatsappFile = 'attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    
    console.log(`📂 Fichier WhatsApp COMPLET: ${whatsappFile}`);
    console.log('🔄 Le système va traiter TOUT l\'historique (anciennes + nouvelles discussions)');
    
    // Lancer la mise à jour complète
    const result = await uploader.weeklyUpdate(whatsappFile);
    
    if (result.success) {
      console.log('\n🎯 MISE À JOUR RÉUSSIE !');
      console.log(`📊 ${result.chunksGenerated} chunks générés depuis l'historique complet`);
      console.log(`📤 ${result.chunksUploaded} chunks uploadés vers Vector Store`);
      console.log(`🔗 Vector Store: ${result.vectorStoreId}`);
      console.log(`📁 Fichiers finaux dans Vector Store: ${result.finalFileCount}`);
      console.log('\n✅ ActiBot est maintenant à jour avec TOUT l\'historique des discussions');
      console.log('💡 Les utilisateurs peuvent maintenant poser des questions sur toute la période');
    } else {
      console.log('\n❌ ERREUR MISE À JOUR');
      console.log(`Détail: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ ERREUR SCRIPT:', error.message);
  }
}

// Instructions d'utilisation
console.log(`
=== INSTRUCTIONS MISE À JOUR WHATSAPP ===

PROCESSUS SIMPLE :
1. Exporter le fichier COMPLET des discussions WhatsApp (anciennes + nouvelles)
2. Remplacer le fichier dans attached_assets/ par le nouveau fichier complet
3. Exécuter: node update-whatsapp-weekly.js
4. Le système va automatiquement :
   ✅ Supprimer complètement l'ancien Vector Store
   ✅ Créer un nouveau Vector Store vide
   ✅ Générer 2320+ nouveaux chunks temporels avec TOUTES les données
   ✅ Uploader les nouveaux chunks vers le nouveau Vector Store
   ✅ ActiBot sera à jour avec tout l'historique complet

⚠️ IMPORTANT: Tu donnes le fichier COMPLET, le système gère tout automatiquement
📅 Fréquence: Selon tes besoins (chaque semaine, tous les 10 jours, etc.)
⏱️ Durée estimée: 5-10 minutes
`);

// Lancer si appelé directement
updateWhatsAppWeekly();