import { updateAssistantInstructions, checkAssistantConfig } from './server/update-assistant-instructions.js';

console.log('=== MISE À JOUR DES INSTRUCTIONS ASSISTANT ===\n');

try {
  // Vérifier la config actuelle
  console.log('Configuration actuelle :');
  await checkAssistantConfig();
  
  console.log('\n--- Mise à jour des instructions ---');
  
  // Mettre à jour les instructions
  const result = await updateAssistantInstructions();
  
  if (result.success) {
    console.log('\n✅ MISE À JOUR RÉUSSIE !');
    console.log('L\'assistant va maintenant répondre uniquement avec les données du Vector Store');
    console.log('\nRègle principale : "D\'après nos discussions WhatsApp..."');
    console.log('Recherche ciblée dans les chunks thématiques');
    console.log('Aucune réponse générique autorisée');
  } else {
    console.log('\n❌ ÉCHEC :');
    console.log(result.error);
  }
  
} catch (error) {
  console.error('❌ ERREUR :', error.message);
}