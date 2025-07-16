import { autoSplitAndUpload, shouldSplitFile } from './auto-split-files.js';
import fs from 'fs';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';

// Test complet du système d'auto-division
async function testCompleteSystem() {
  console.log('🧪 Test complet du système d\'auto-division\n');

  // Test 1: Créer un gros fichier de test
  console.log('1. Création d\'un gros fichier de test...');
  const testContent = Array(6000).fill(0).map((_, i) => {
    const month = String(Math.floor(i / 500) + 1).padStart(2, '0');
    const day = String((i % 30) + 1).padStart(2, '0');
    return `${day}/${month}/2024, 10:${String(i % 60).padStart(2, '0')} - Utilisateur ${i % 5 + 1}: Message de test numéro ${i + 1}. Ceci est un contenu de test pour valider le système d'auto-division d'ActiBot.`;
  }).join('\n');
  
  fs.writeFileSync('test-big-file.txt', testContent);
  console.log('✅ Fichier de test créé:', testContent.split('\n').length, 'lignes');

  // Test 2: Vérifier si division nécessaire
  console.log('\n2. Vérification de la nécessité de division...');
  const needsSplit = shouldSplitFile(testContent);
  console.log('Division nécessaire:', needsSplit);

  // Test 3: Simulation d'upload avec auto-division
  if (needsSplit) {
    console.log('\n3. Test d\'auto-division...');
    try {
      const result = await autoSplitAndUpload(testContent, 'Test Big File WhatsApp.txt');
      if (result) {
        console.log('✅ Auto-division réussie!');
        console.log('Fichier original:', result.originalFile);
        console.log('Chunks créés:', result.chunksCreated);
        console.log('Fichiers uploadés:', result.uploadedFiles.length);
        
        // Afficher les détails des chunks
        result.uploadedFiles.forEach((file, i) => {
          console.log(`  Chunk ${i + 1}: ${file.title} (${file.lines} lignes) - ID: ${file.id}`);
        });
      } else {
        console.log('❌ Auto-division échouée');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'auto-division:', error.message);
    }
  }

  // Test 4: Simulation d'insertion en base
  console.log('\n4. Test d\'insertion en base de données...');
  try {
    const [document] = await db.insert(documents).values({
      title: 'Test Big File WhatsApp.txt',
      content: testContent.slice(0, 1000) + '\n\n[Auto-divisé pour test]',
      uploadedBy: 1 // ID admin
    }).returning();
    
    console.log('✅ Document inséré en base:', document.id);
    
    // Nettoyer après test
    await db.delete(documents).where({ id: document.id });
    console.log('✅ Document de test supprimé');
  } catch (error) {
    console.error('❌ Erreur base de données:', error.message);
  }

  // Nettoyer le fichier de test
  fs.unlinkSync('test-big-file.txt');
  console.log('✅ Fichier de test nettoyé');

  console.log('\n🎉 Test complet terminé!');
}

// Exécuter le test
testCompleteSystem().catch(console.error);