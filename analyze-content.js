import fs from 'fs';

console.log('=== ANALYSE DU CONTENU WHATSAPP ===\n');

try {
  const whatsappFile = './attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
  const content = fs.readFileSync(whatsappFile, 'utf-8');
  
  console.log(`Taille totale: ${content.length} caractères`);
  console.log(`Nombre de lignes: ${content.split('\n').length}`);
  
  // Chercher spécifiquement NotebookLM dans le contenu
  const lines = content.split('\n');
  const notebookLMLines = [];
  const christopheBatierLines = [];
  const recentLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Rechercher NotebookLM
    if (line.toLowerCase().includes('notebooklm')) {
      notebookLMLines.push({
        lineNumber: i + 1,
        content: line,
        context: lines.slice(Math.max(0, i-2), Math.min(lines.length, i+3))
      });
    }
    
    // Rechercher Christophe Batier
    if (line.toLowerCase().includes('christophe') && line.toLowerCase().includes('batier')) {
      christopheBatierLines.push({
        lineNumber: i + 1,
        content: line,
        context: lines.slice(Math.max(0, i-2), Math.min(lines.length, i+3))
      });
    }
    
    // Rechercher les données de juillet 2025
    if (line.includes('07/2025') || line.includes('/07/2025')) {
      recentLines.push({
        lineNumber: i + 1,
        content: line
      });
    }
  }
  
  console.log(`\n=== RÉSULTATS NOTEBOOKLM ===`);
  console.log(`Mentions trouvées: ${notebookLMLines.length}`);
  
  notebookLMLines.forEach((item, index) => {
    console.log(`\n--- Mention ${index + 1} (ligne ${item.lineNumber}) ---`);
    console.log('Contexte:');
    item.context.forEach(contextLine => {
      console.log(`  ${contextLine}`);
    });
  });
  
  console.log(`\n=== RÉSULTATS CHRISTOPHE BATIER ===`);
  console.log(`Mentions trouvées: ${christopheBatierLines.length}`);
  
  christopheBatierLines.forEach((item, index) => {
    console.log(`\n--- Mention ${index + 1} (ligne ${item.lineNumber}) ---`);
    console.log('Contexte:');
    item.context.forEach(contextLine => {
      console.log(`  ${contextLine}`);
    });
  });
  
  console.log(`\n=== DONNÉES JUILLET 2025 ===`);
  console.log(`Lignes avec 07/2025: ${recentLines.length}`);
  
  recentLines.slice(0, 10).forEach((item, index) => {
    console.log(`Ligne ${item.lineNumber}: ${item.content.substring(0, 100)}...`);
  });
  
  // Analyser la structure des dates
  console.log(`\n=== ANALYSE DES DATES ===`);
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
  const dates = content.match(datePattern) || [];
  const uniqueDates = [...new Set(dates)];
  
  console.log(`Dates uniques trouvées: ${uniqueDates.length}`);
  console.log('Échantillon des dates:');
  uniqueDates.slice(-20).forEach(date => console.log(`  ${date}`));
  
} catch (error) {
  console.error('Erreur analyse:', error.message);
}