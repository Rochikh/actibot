import { processRecentDataOnly } from './server/recent-data-manager.js';

// Variables d'environnement directes
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('=== TEST TRAITEMENT DONNÉES RÉCENTES ===');
console.log('Début du processus...\n');

try {
  const result = await processRecentDataOnly();
  
  console.log('\n=== RÉSULTAT ===');
  if (result.success) {
    console.log('✅ SUCCÈS !');
    console.log(`Vector Store ID: ${result.vectorStoreId}`);
    console.log(`Chunks traités: ${result.chunksProcessed}`);
    console.log(`Taille données récentes: ${result.recentDataSize} caractères`);
  } else {
    console.log('❌ ÉCHEC :');
    console.log(result.error);
  }
} catch (error) {
  console.error('❌ ERREUR SCRIPT :', error.message);
}