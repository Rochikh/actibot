import { TemporalChunker } from './server/temporal-chunking.js';
import path from 'path';

async function testTemporalChunking() {
  console.log('=== TEST CHUNKING TEMPOREL CLAUDE 4.0 ===\n');
  
  try {
    // Initialiser le chunker avec les paramètres optimaux
    const chunker = new TemporalChunker(500, 5); // 500 tokens, 5 messages overlap
    
    // Chercher le fichier WhatsApp
    const whatsappFile = 'attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    
    console.log('Traitement du fichier WhatsApp avec chunking temporel...');
    const chunks = await chunker.processWhatsappFile(whatsappFile);
    
    // Sauvegarder les chunks
    await chunker.saveTemporalChunks(chunks);
    
    // Analyser spécifiquement les chunks de juillet 2025
    console.log('\n=== ANALYSE CHUNKS JUILLET 2025 ===');
    const julyChunks = chunks.filter(chunk => 
      chunk.metadata.dateStart?.includes('07/2025') || 
      chunk.metadata.dateEnd?.includes('07/2025')
    );
    
    console.log(`Chunks contenant juillet 2025: ${julyChunks.length}`);
    
    for (const chunk of julyChunks) {
      console.log(`\n--- Chunk Juillet ---`);
      console.log(`Période: ${chunk.metadata.dateStart} → ${chunk.metadata.dateEnd}`);
      console.log(`Participants: ${chunk.metadata.participants.join(', ')}`);
      console.log(`Topics: ${chunk.metadata.topics.join(', ')}`);
      
      // Vérifier si ce chunk contient l'info sur Rochane
      const hasRochane = chunk.content.toLowerCase().includes('rochane');
      const hasSwiss = chunk.content.toLowerCase().includes('suisse') || chunk.content.toLowerCase().includes('swiss');
      const hasEPFL = chunk.content.toLowerCase().includes('epfl') || chunk.content.toLowerCase().includes('ethz');
      
      console.log(`Contient Rochane: ${hasRochane ? '✅' : '❌'}`);
      console.log(`Contient Suisse: ${hasSwiss ? '✅' : '❌'}`);
      console.log(`Contient EPFL/ETHZ: ${hasEPFL ? '✅' : '❌'}`);
      
      if (hasRochane && hasSwiss) {
        console.log('🎯 CHUNK CIBLE TROUVÉ !');
        console.log(`Aperçu: ${chunk.content.substring(0, 300)}...`);
      }
    }
    
    return { success: true, chunksCount: chunks.length, julyChunks: julyChunks.length };
    
  } catch (error) {
    console.error('❌ Erreur test chunking temporel:', error.message);
    return { success: false, error: error.message };
  }
}

// Exécuter le test
testTemporalChunking().then(result => {
  if (result.success) {
    console.log(`\n✅ Test terminé: ${result.chunksCount} chunks créés, ${result.julyChunks} pour juillet 2025`);
  } else {
    console.log(`\n❌ Test échoué: ${result.error}`);
  }
});