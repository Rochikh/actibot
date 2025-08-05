import { diagnoseVectorStore } from './server/diagnose-vector-store.js';

console.log('=== DIAGNOSTIC COMPLET VECTOR STORE ===\n');

try {
  await diagnoseVectorStore();
} catch (error) {
  console.error('❌ ERREUR DIAGNOSTIC:', error.message);
}