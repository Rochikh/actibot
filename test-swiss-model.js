import { createSwissModelChunk } from './server/create-swiss-model-chunk.js';

console.log('=== CRÉATION CHUNK MODÈLE SUISSE SPÉCIALISÉ ===\n');

try {
  const result = await createSwissModelChunk();
  
  if (result.success) {
    console.log('\n🎯 CHUNK MODÈLE SUISSE CRÉÉ !');
    console.log(`File ID: ${result.fileId}`);
    console.log(`Date: ${result.date}`);
    console.log(`Participant: ${result.participant}`);
    console.log(`Vector Store: ${result.vectorStoreId}`);
    
    console.log('\n=== INFORMATIONS CAPTURÉES ===');
    console.log('✅ Lien Courrier International exact');
    console.log('✅ EPFL + ETHZ + supercalculateur Alps');
    console.log('✅ 10,000 GPU Nvidia à Lugano');
    console.log('✅ Open source complet + transparence totale');
    console.log('✅ Date précise: 27 juillet 2025, 19:41');
    
    console.log('\nMaintenant l\'assistant devrait répondre précisément à:');
    console.log('"En juillet 2025, une personne a parlé d\'un nouveau modèle suisse"');
    console.log('Avec tous les détails : Rochane, 27/07, EPFL/ETHZ, Alps, etc.');
  } else {
    console.log('❌ ÉCHEC:', result.error);
  }
} catch (error) {
  console.error('❌ ERREUR:', error.message);
}