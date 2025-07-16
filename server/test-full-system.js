import { autoSplitAndUpload, shouldSplitFile } from './auto-split-files.js';
import fs from 'fs';

console.log('🧪 Test complet du système d\'auto-division ActiBot\n');

// Test du système complet
async function testFullSystem() {
  try {
    // Test 1: Vérifier le fichier WhatsApp existant
    const whatsappFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
    
    if (fs.existsSync(whatsappFile)) {
      console.log('✅ Fichier WhatsApp trouvé');
      const content = fs.readFileSync(whatsappFile, 'utf-8');
      const lines = content.split('\n').length;
      const sizeKB = Math.round(Buffer.byteLength(content, 'utf8') / 1024);
      
      console.log(`📊 Statistiques du fichier:`);
      console.log(`   - Lignes: ${lines}`);
      console.log(`   - Taille: ${sizeKB} KB`);
      console.log(`   - Division nécessaire: ${shouldSplitFile(content)}`);
      
      if (shouldSplitFile(content)) {
        console.log('\n🔄 Test de division automatique...');
        const result = await autoSplitAndUpload(content, 'Test WhatsApp Division.txt');
        
        if (result) {
          console.log('✅ Division réussie!');
          console.log(`   - Fichier original: ${result.originalFile}`);
          console.log(`   - Chunks créés: ${result.chunksCreated}`);
          console.log(`   - Fichiers uploadés: ${result.uploadedFiles.length}`);
          
          // Afficher les premiers chunks
          result.uploadedFiles.slice(0, 5).forEach((file, i) => {
            console.log(`   - Chunk ${i + 1}: ${file.title} (${file.lines} lignes)`);
          });
          
          if (result.uploadedFiles.length > 5) {
            console.log(`   - ... et ${result.uploadedFiles.length - 5} autres chunks`);
          }
        } else {
          console.log('❌ Division échouée');
        }
      }
    } else {
      console.log('❌ Fichier WhatsApp non trouvé');
    }
    
    // Test 2: Création d'un petit fichier (ne doit pas être divisé)
    console.log('\n📝 Test avec petit fichier...');
    const smallFile = 'Petit fichier de test\nPas besoin de division\nCe fichier est trop petit';
    console.log(`Division nécessaire: ${shouldSplitFile(smallFile)}`);
    
    // Test 3: Création d'un gros fichier (doit être divisé)
    console.log('\n📝 Test avec gros fichier...');
    const bigFile = Array(6000).fill('Ligne de test pour gros fichier').join('\n');
    console.log(`Division nécessaire: ${shouldSplitFile(bigFile)}`);
    
    console.log('\n🎉 Tests terminés avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Lancer le test
testFullSystem();