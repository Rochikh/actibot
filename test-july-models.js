import { createJulyModelsChunk } from './server/create-july-models-chunk.js';

console.log('=== CRÉATION CHUNK MODÈLES JUILLET 2025 ===\n');

try {
  const result = await createJulyModelsChunk();
  
  if (result.success) {
    console.log('\n✅ CHUNK JUILLET 2025 CRÉÉ !');
    console.log(`File ID: ${result.fileId}`);
    console.log(`Vector Store: ${result.vectorStoreId}`);
    console.log(`Lignes de contenu: ${result.contentLines}`);
    console.log('\nModèles identifiés en juillet 2025:');
    console.log('- Google N3 (récemment intéressant en local)');
    console.log('- DeepSeek R1 (raisonnement, très utilisé universités)');
    console.log('- Mistral Small (version récente)');
    console.log('- Ollama (modèles pour institutions)');
    console.log('\nL\'assistant devrait maintenant trouver ces discussions !');
  } else {
    console.log('❌ ÉCHEC:', result.error);
  }
} catch (error) {
  console.error('❌ ERREUR:', error.message);
}