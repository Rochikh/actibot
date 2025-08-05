import { TemporalChunkUploader } from './server/upload-temporal-chunks.js';

/**
 * Script de mise à jour hebdomadaire des discussions WhatsApp
 * À exécuter chaque semaine avec le nouveau fichier export
 */
async function updateWhatsAppWeekly() {
  console.log('=== MISE À JOUR HEBDOMADAIRE ACTIBOT ===\n');
  
  try {
    const uploader = new TemporalChunkUploader();
    
    // Chemin vers le fichier WhatsApp le plus récent
    const whatsappFile = 'attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    
    console.log(`Fichier WhatsApp: ${whatsappFile}`);
    
    // Lancer la mise à jour complète
    const result = await uploader.weeklyUpdate(whatsappFile);
    
    if (result.success) {
      console.log('\n🎯 MISE À JOUR RÉUSSIE !');
      console.log(`- ${result.chunksGenerated} chunks générés`);
      console.log(`- ${result.chunksUploaded} chunks uploadés`);
      console.log(`- Vector Store: ${result.vectorStoreId}`);
      console.log('\n✅ ActiBot est à jour avec les dernières discussions');
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
=== INSTRUCTIONS MISE À JOUR HEBDOMADAIRE ===

1. Exporter les nouvelles discussions WhatsApp
2. Remplacer le fichier dans attached_assets/
3. Exécuter: node update-whatsapp-weekly.js
4. ActiBot sera automatiquement mis à jour

Fréquence recommandée: Chaque lundi matin
Durée estimée: 5-10 minutes
`);

// Lancer si appelé directement
updateWhatsAppWeekly();