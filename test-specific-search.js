import fs from 'fs';

console.log('=== RECHERCHE SPÉCIFIQUE NOTEBOOKLM VIDÉO ===\n');

try {
  const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  const content = fs.readFileSync(whatsappFile, 'utf-8');
  
  const lines = content.split('\n');
  const videoNotebookLines = [];
  
  console.log('Recherche de "NotebookLM" + "vidéo" dans le même contexte...\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Rechercher NotebookLM et vidéo dans un contexte proche
    if (lowerLine.includes('notebooklm') || lowerLine.includes('notebook lm')) {
      // Vérifier le contexte autour (10 lignes avant et après)
      const contextStart = Math.max(0, i - 10);
      const contextEnd = Math.min(lines.length, i + 10);
      const context = lines.slice(contextStart, contextEnd);
      
      // Chercher "vidéo" dans ce contexte
      const hasVideo = context.some(contextLine => 
        contextLine.toLowerCase().includes('vidéo') || 
        contextLine.toLowerCase().includes('video') ||
        contextLine.toLowerCase().includes('générer') ||
        contextLine.toLowerCase().includes('création')
      );
      
      if (hasVideo) {
        videoNotebookLines.push({
          lineNumber: i + 1,
          mainLine: line,
          context: context,
          contextStart: contextStart + 1,
          contextEnd: contextEnd + 1
        });
      }
    }
  }
  
  console.log(`Résultats trouvés: ${videoNotebookLines.length}\n`);
  
  videoNotebookLines.forEach((item, index) => {
    console.log(`=== RÉSULTAT ${index + 1} ===`);
    console.log(`Ligne principale (${item.lineNumber}): ${item.mainLine}`);
    console.log(`Contexte (lignes ${item.contextStart}-${item.contextEnd}):`);
    item.context.forEach((contextLine, idx) => {
      const lineNum = item.contextStart + idx;
      const prefix = lineNum === item.lineNumber ? '>>> ' : '    ';
      console.log(`${prefix}${lineNum}: ${contextLine}`);
    });
    console.log('\n');
  });
  
  // Recherche spécifique de mentions de génération de vidéo
  console.log('=== RECHERCHE "GÉNÉRATION VIDÉO" SPÉCIFIQUE ===\n');
  
  const videoGenerationLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    if ((lowerLine.includes('générer') || lowerLine.includes('génération') || lowerLine.includes('créer')) && 
        (lowerLine.includes('vidéo') || lowerLine.includes('video'))) {
      videoGenerationLines.push({
        lineNumber: i + 1,
        content: line,
        context: lines.slice(Math.max(0, i-3), Math.min(lines.length, i+4))
      });
    }
  }
  
  console.log(`Mentions "génération vidéo": ${videoGenerationLines.length}\n`);
  
  videoGenerationLines.slice(0, 5).forEach((item, index) => {
    console.log(`--- Mention ${index + 1} (ligne ${item.lineNumber}) ---`);
    item.context.forEach(contextLine => {
      console.log(`  ${contextLine}`);
    });
    console.log();
  });
  
} catch (error) {
  console.error('Erreur:', error.message);
}