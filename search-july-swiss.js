import fs from 'fs';

console.log('=== RECHERCHE MODÈLE SUISSE JUILLET 2025 ===\n');

try {
  const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  const content = fs.readFileSync(whatsappFile, 'utf-8');
  
  const lines = content.split('\n');
  const julyLines = [];
  const swissLines = [];
  
  // Récupérer toutes les lignes de juillet 2025
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('/07/2025')) {
      julyLines.push({
        lineNumber: i + 1,
        content: line
      });
    }
    
    // Chercher mentions de Suisse en juillet
    if (line.includes('/07/2025') && 
        (line.toLowerCase().includes('suisse') || 
         line.toLowerCase().includes('swiss') || 
         line.toLowerCase().includes('switzerland') ||
         line.toLowerCase().includes('modèle') ||
         line.toLowerCase().includes('model'))) {
      swissLines.push({
        lineNumber: i + 1,
        content: line,
        context: lines.slice(Math.max(0, i-5), Math.min(lines.length, i+6))
      });
    }
  }
  
  console.log(`=== DONNÉES JUILLET 2025 ===`);
  console.log(`Total lignes juillet: ${julyLines.length}`);
  
  // Afficher les dernières lignes de juillet pour voir la fin
  console.log('\n--- Dernières lignes juillet 2025 ---');
  julyLines.slice(-20).forEach(item => {
    console.log(`${item.lineNumber}: ${item.content.substring(0, 100)}...`);
  });
  
  console.log(`\n=== MENTIONS SUISSE/MODÈLE EN JUILLET ===`);
  console.log(`Résultats trouvés: ${swissLines.length}`);
  
  swissLines.forEach((item, index) => {
    console.log(`\n--- Résultat ${index + 1} (ligne ${item.lineNumber}) ---`);
    console.log('Contexte:');
    item.context.forEach(contextLine => {
      console.log(`  ${contextLine}`);
    });
  });
  
  // Recherche plus large pour "modèle" en juillet
  console.log(`\n=== RECHERCHE "MODÈLE" EN JUILLET 2025 ===`);
  const modelLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('/07/2025') && 
        (line.toLowerCase().includes('modèle') || 
         line.toLowerCase().includes('model') ||
         line.toLowerCase().includes('nouveau') ||
         line.toLowerCase().includes('sortie') ||
         line.toLowerCase().includes('lancement'))) {
      modelLines.push({
        lineNumber: i + 1,
        content: line,
        context: lines.slice(Math.max(0, i-3), Math.min(lines.length, i+4))
      });
    }
  }
  
  console.log(`Mentions "modèle" en juillet: ${modelLines.length}`);
  
  modelLines.forEach((item, index) => {
    console.log(`\n--- Modèle ${index + 1} (ligne ${item.lineNumber}) ---`);
    item.context.forEach(contextLine => {
      console.log(`  ${contextLine}`);
    });
  });
  
} catch (error) {
  console.error('Erreur:', error.message);
}