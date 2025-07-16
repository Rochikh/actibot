import { autoSplitAndUpload, shouldSplitFile } from './auto-split-files.js';
import fs from 'fs';

console.log('🧪 Test du système d\'auto-division\n');

// Test 1: Fichier petit (ne doit pas être divisé)
console.log('Test 1: Fichier petit');
const smallContent = 'Ceci est un petit fichier de test\nAvec quelques lignes seulement\nPour tester la détection';
console.log('Doit être divisé:', shouldSplitFile(smallContent));
console.log('');

// Test 2: Fichier volumineux (doit être divisé)
console.log('Test 2: Fichier volumineux');
const bigContent = 'A'.repeat(2000000); // 2MB de contenu
console.log('Doit être divisé:', shouldSplitFile(bigContent));
console.log('');

// Test 3: Fichier avec beaucoup de lignes
console.log('Test 3: Fichier avec beaucoup de lignes');
const manyLines = Array(6000).fill('Ligne de test').join('\n');
console.log('Doit être divisé:', shouldSplitFile(manyLines));
console.log('');

// Test 4: Test avec le vrai fichier WhatsApp
console.log('Test 4: Fichier WhatsApp réel');
const whatsappFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
if (fs.existsSync(whatsappFile)) {
  const whatsappContent = fs.readFileSync(whatsappFile, 'utf-8');
  console.log('Lignes:', whatsappContent.split('\n').length);
  console.log('Taille KB:', Math.round(Buffer.byteLength(whatsappContent, 'utf8') / 1024));
  console.log('Doit être divisé:', shouldSplitFile(whatsappContent));
  
  // Test d'auto-division (simulation)
  console.log('\n🔄 Simulation d\'auto-division...');
  try {
    const result = await autoSplitAndUpload(whatsappContent, 'Test Discussion WhatsApp.txt');
    if (result) {
      console.log('✅ Auto-division réussie!');
      console.log('Chunks créés:', result.chunksCreated);
      console.log('Fichiers uploadés:', result.uploadedFiles.length);
    } else {
      console.log('❌ Auto-division échouée');
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
} else {
  console.log('Fichier WhatsApp non trouvé');
}