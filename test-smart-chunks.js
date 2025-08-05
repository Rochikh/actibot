import { createSmartVectorStore } from './server/smart-chunking.js';

console.log('=== TEST CHUNKS INTELLIGENTS ===');
console.log('Création de chunks thématiques optimisés...\n');

try {
  const result = await createSmartVectorStore();
  
  console.log('\n=== RÉSULTAT ===');
  if (result.success) {
    console.log('✅ CHUNKS INTELLIGENTS CRÉÉS !');
    console.log(`Vector Store ID: ${result.vectorStoreId}`);
    console.log(`Chunks thématiques: ${result.chunksUploaded}/${result.totalChunks}`);
    console.log('\nMaintenant l\'assistant peut chercher par thème :');
    console.log('- NotebookLM : informations spécifiques sur cet outil');
    console.log('- ChristopheBatier : toutes ses interventions');
    console.log('- Discussions_Juillet_2025 : tout le contenu récent');
  } else {
    console.log('❌ ÉCHEC :');
    console.log(result.error);
  }
} catch (error) {
  console.error('❌ ERREUR :', error.message);
}