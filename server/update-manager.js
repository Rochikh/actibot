import OpenAI from 'openai';
import fs from 'fs';
import { autoSplitAndUpload } from './auto-split-files.js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

/**
 * Option 1: Mise à jour incrémentale (ajouter seulement les nouvelles discussions)
 */
async function incrementalUpdate(newContent, filename) {
  console.log('🔄 Mise à jour incrémentale...');
  
  try {
    // Diviser et uploader seulement le nouveau contenu
    const result = await autoSplitAndUpload(newContent, `${filename} (Mise à jour ${new Date().toISOString().split('T')[0]})`);
    
    if (result) {
      console.log('✅ Mise à jour incrémentale réussie!');
      console.log(`📊 Nouveau contenu divisé en ${result.chunksCreated} chunks`);
      return {
        type: 'incremental',
        ...result
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur mise à jour incrémentale:', error.message);
    return null;
  }
}

/**
 * Option 2: Mise à jour complète (remplacer tout le contenu)
 */
async function fullReplacement(newContent, filename) {
  console.log('🔄 Remplacement complet...');
  
  try {
    // 1. Supprimer tous les anciens fichiers du Vector Store
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
    
    console.log('🗑️ Suppression des anciens fichiers...');
    const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
    const files = await openai.beta.vectorStores.files.list(vectorStoreId);
    
    let deletedCount = 0;
    for (const file of files.data) {
      try {
        await openai.beta.vectorStores.files.del(vectorStoreId, file.id);
        await openai.files.del(file.id);
        deletedCount++;
      } catch (error) {
        console.warn(`⚠️ Impossible de supprimer ${file.id}:`, error.message);
      }
    }
    
    console.log(`✅ ${deletedCount} anciens fichiers supprimés`);
    
    // 2. Uploader le nouveau contenu complet
    const result = await autoSplitAndUpload(newContent, filename);
    
    if (result) {
      console.log('✅ Remplacement complet réussi!');
      console.log(`📊 Nouveau contenu divisé en ${result.chunksCreated} chunks`);
      return {
        type: 'full_replacement',
        deletedFiles: deletedCount,
        ...result
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur remplacement complet:', error.message);
    return null;
  }
}

/**
 * Analyse les différences entre ancien et nouveau contenu
 */
function analyzeContentDifferences(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const stats = {
    oldLines: oldLines.length,
    newLines: newLines.length,
    addedLines: newLines.length - oldLines.length,
    percentageIncrease: ((newLines.length - oldLines.length) / oldLines.length * 100).toFixed(2)
  };
  
  console.log('📊 Analyse des différences:');
  console.log(`   - Ancien fichier: ${stats.oldLines} lignes`);
  console.log(`   - Nouveau fichier: ${stats.newLines} lignes`);
  console.log(`   - Lignes ajoutées: ${stats.addedLines}`);
  console.log(`   - Augmentation: ${stats.percentageIncrease}%`);
  
  return stats;
}

/**
 * Recommandation automatique du type de mise à jour
 */
function recommendUpdateType(stats) {
  const increasePercentage = parseFloat(stats.percentageIncrease);
  
  if (increasePercentage < 20) {
    return {
      recommended: 'incremental',
      reason: 'Augmentation modérée du contenu (<20%), mise à jour incrémentale recommandée'
    };
  } else if (increasePercentage > 50) {
    return {
      recommended: 'full_replacement',
      reason: 'Augmentation importante du contenu (>50%), remplacement complet recommandé'
    };
  } else {
    return {
      recommended: 'user_choice',
      reason: 'Augmentation modérée (20-50%), les deux options sont viables'
    };
  }
}

/**
 * Gestionnaire principal des mises à jour
 */
async function manageUpdate(oldFilePath, newFilePath, updateType = 'auto') {
  console.log('🔄 Gestionnaire de mise à jour ActiBot\n');
  
  try {
    // Lire les fichiers
    const oldContent = fs.existsSync(oldFilePath) ? fs.readFileSync(oldFilePath, 'utf-8') : '';
    const newContent = fs.readFileSync(newFilePath, 'utf-8');
    
    // Analyser les différences
    const stats = analyzeContentDifferences(oldContent, newContent);
    const recommendation = recommendUpdateType(stats);
    
    console.log(`💡 Recommandation: ${recommendation.recommended}`);
    console.log(`   ${recommendation.reason}\n`);
    
    let result;
    const filename = 'Discussion WhatsApp avec Ai-Dialogue Actif.txt';
    
    if (updateType === 'auto') {
      updateType = recommendation.recommended === 'user_choice' ? 'incremental' : recommendation.recommended;
    }
    
    switch (updateType) {
      case 'incremental':
        // Extraire seulement les nouvelles discussions
        const newOnlyContent = extractNewContent(oldContent, newContent);
        if (newOnlyContent) {
          result = await incrementalUpdate(newOnlyContent, filename);
        } else {
          console.log('ℹ️ Aucun nouveau contenu détecté');
          return null;
        }
        break;
        
      case 'full_replacement':
        result = await fullReplacement(newContent, filename);
        break;
        
      default:
        console.error('❌ Type de mise à jour non reconnu:', updateType);
        return null;
    }
    
    return {
      updateType,
      stats,
      recommendation,
      result
    };
    
  } catch (error) {
    console.error('❌ Erreur gestionnaire de mise à jour:', error.message);
    return null;
  }
}

/**
 * Extrait seulement le nouveau contenu par rapport à l'ancien
 */
function extractNewContent(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Trouver où commence le nouveau contenu
  let startIndex = 0;
  for (let i = oldLines.length - 1; i >= 0; i--) {
    const lineIndex = newLines.indexOf(oldLines[i]);
    if (lineIndex !== -1) {
      startIndex = lineIndex + 1;
      break;
    }
  }
  
  if (startIndex >= newLines.length) {
    return null; // Pas de nouveau contenu
  }
  
  const newOnlyLines = newLines.slice(startIndex);
  return newOnlyLines.join('\n');
}

export { manageUpdate, incrementalUpdate, fullReplacement, analyzeContentDifferences };

// Test si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const oldFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  const newFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  
  manageUpdate(oldFile, newFile, 'auto');
}