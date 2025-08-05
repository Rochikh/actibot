import { createSpecificVideoChunk } from './server/create-specific-chunk.js';

console.log('=== CRÉATION CHUNK SPÉCIALISÉ NOTEBOOKLM VIDÉO ===\n');

try {
  const result = await createSpecificVideoChunk();
  
  if (result.success) {
    console.log('\n✅ CHUNK SPÉCIALISÉ CRÉÉ !');
    console.log(`File ID: ${result.fileId}`);
    console.log(`Vector Store: ${result.vectorStoreId}`);
    console.log(`Lignes de conversation: ${result.conversationLines}`);
    console.log('\nMaintenant l\'assistant devrait trouver:');
    console.log('- La question de Laurent The Cure du 30/04/2025');
    console.log('- Les réponses avec Hedra et HeyGen');
    console.log('- La confirmation que HeyGen fonctionne');
  } else {
    console.log('❌ ÉCHEC:', result.error);
  }
} catch (error) {
  console.error('❌ ERREUR:', error.message);
}