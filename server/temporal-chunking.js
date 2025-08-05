import fs from 'fs';
import path from 'path';

/**
 * Chunking temporel optimisé pour WhatsApp selon les recommandations de Claude 4.0
 * Maintient la continuité conversationnelle et les métadonnées temporelles
 */
class TemporalChunker {
  constructor(maxTokens = 500, overlapMessages = 5) {
    this.maxTokens = maxTokens;
    this.overlapMessages = overlapMessages;
  }

  /**
   * Estime le nombre de tokens approximatif (1 token ≈ 4 caractères)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Extrait les métadonnées d'un message WhatsApp
   */
  extractMessageMetadata(line) {
    // Format: [27/07/2025, 19:41:23] Rochane: message
    const dateTimeRegex = /\[(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})\]\s*([^:]+):/;
    const match = line.match(dateTimeRegex);
    
    if (match) {
      return {
        date: match[1],
        time: match[2],
        participant: match[3].trim(),
        hasDateTime: true
      };
    }
    
    return { hasDateTime: false };
  }

  /**
   * Découpage temporel avec overlap et métadonnées
   */
  chunkWhatsappTemporal(text) {
    const lines = text.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    let chunkMetadata = {
      dateStart: null,
      dateEnd: null,
      participants: new Set(),
      topics: new Set()
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const messageData = this.extractMessageMetadata(line);
      
      // Si on a une nouvelle date/heure, mettre à jour les métadonnées
      if (messageData.hasDateTime) {
        if (!chunkMetadata.dateStart) {
          chunkMetadata.dateStart = messageData.date;
        }
        chunkMetadata.dateEnd = messageData.date;
        chunkMetadata.participants.add(messageData.participant);
        
        // Détecter les topics par mots-clés
        const lowercaseLine = line.toLowerCase();
        if (lowercaseLine.includes('modèle') || lowercaseLine.includes('model')) {
          chunkMetadata.topics.add('modèle IA');
        }
        if (lowercaseLine.includes('suisse') || lowercaseLine.includes('swiss')) {
          chunkMetadata.topics.add('Suisse');
        }
        if (lowercaseLine.includes('epfl') || lowercaseLine.includes('ethz')) {
          chunkMetadata.topics.add('universités suisses');
        }
        if (lowercaseLine.includes('podcast')) {
          chunkMetadata.topics.add('podcast');
        }
        if (lowercaseLine.includes('notebooklm')) {
          chunkMetadata.topics.add('NotebookLM');
        }
      }

      currentChunk.push(line);
      currentTokens += this.estimateTokens(line);

      // Si on dépasse la limite de tokens, créer un nouveau chunk
      if (currentTokens > this.maxTokens && currentChunk.length > this.overlapMessages) {
        // Créer le chunk avec métadonnées
        const chunkText = currentChunk.join('\n');
        const finalMetadata = {
          dateStart: chunkMetadata.dateStart,
          dateEnd: chunkMetadata.dateEnd,
          participants: Array.from(chunkMetadata.participants),
          topics: Array.from(chunkMetadata.topics),
          tokenCount: currentTokens,
          messageCount: currentChunk.length
        };

        chunks.push({
          content: chunkText,
          metadata: finalMetadata
        });

        // Préparer l'overlap pour le chunk suivant
        const overlapStart = Math.max(0, currentChunk.length - this.overlapMessages);
        const overlapChunk = currentChunk.slice(overlapStart);
        
        currentChunk = overlapChunk;
        currentTokens = overlapChunk.reduce((sum, line) => sum + this.estimateTokens(line), 0);
        
        // Réinitialiser les métadonnées mais garder les dernières infos d'overlap
        const lastMessageData = this.extractMessageMetadata(overlapChunk[overlapChunk.length - 1] || '');
        chunkMetadata = {
          dateStart: lastMessageData.hasDateTime ? lastMessageData.date : null,
          dateEnd: lastMessageData.hasDateTime ? lastMessageData.date : null,
          participants: lastMessageData.hasDateTime ? new Set([lastMessageData.participant]) : new Set(),
          topics: new Set()
        };
      }
    }

    // Ajouter le dernier chunk s'il reste du contenu
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join('\n');
      const finalMetadata = {
        dateStart: chunkMetadata.dateStart,
        dateEnd: chunkMetadata.dateEnd,
        participants: Array.from(chunkMetadata.participants),
        topics: Array.from(chunkMetadata.topics),
        tokenCount: currentTokens,
        messageCount: currentChunk.length
      };

      chunks.push({
        content: chunkText,
        metadata: finalMetadata
      });
    }

    return chunks;
  }

  /**
   * Traite le fichier WhatsApp complet avec chunking temporel
   */
  async processWhatsappFile(filePath) {
    try {
      console.log(`Lecture du fichier: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      console.log(`Taille du fichier: ${Math.round(content.length / 1024)}KB`);
      console.log(`Nombre de lignes: ${content.split('\n').length}`);
      
      const chunks = this.chunkWhatsappTemporal(content);
      
      console.log(`\n=== RÉSULTATS CHUNKING TEMPOREL ===`);
      console.log(`Nombre de chunks créés: ${chunks.length}`);
      
      // Analyser la distribution
      const avgTokens = chunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0) / chunks.length;
      const avgMessages = chunks.reduce((sum, chunk) => sum + chunk.metadata.messageCount, 0) / chunks.length;
      
      console.log(`Tokens moyen par chunk: ${Math.round(avgTokens)}`);
      console.log(`Messages moyen par chunk: ${Math.round(avgMessages)}`);
      
      // Afficher quelques exemples
      console.log(`\n=== EXEMPLES DE CHUNKS ===`);
      for (let i = 0; i < Math.min(3, chunks.length); i++) {
        const chunk = chunks[i];
        console.log(`\nChunk ${i + 1}:`);
        console.log(`- Période: ${chunk.metadata.dateStart} → ${chunk.metadata.dateEnd}`);
        console.log(`- Participants: ${chunk.metadata.participants.join(', ')}`);
        console.log(`- Topics: ${chunk.metadata.topics.join(', ')}`);
        console.log(`- Tokens: ${chunk.metadata.tokenCount}`);
        console.log(`- Aperçu: ${chunk.content.substring(0, 150)}...`);
      }
      
      return chunks;
      
    } catch (error) {
      console.error('Erreur processing:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde les chunks avec métadonnées enrichies
   */
  async saveTemporalChunks(chunks, outputDir = 'temporal_chunks') {
    try {
      // Créer le dossier de sortie
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(`\n=== SAUVEGARDE CHUNKS TEMPORELS ===`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Créer un nom de fichier descriptif
        const dateRange = chunk.metadata.dateStart === chunk.metadata.dateEnd 
          ? chunk.metadata.dateStart?.replace(/\//g, '-') || `chunk-${i+1}`
          : `${chunk.metadata.dateStart?.replace(/\//g, '-')}_to_${chunk.metadata.dateEnd?.replace(/\//g, '-')}`;
        
        const filename = `temporal_${dateRange}_${i+1}.txt`;
        const filepath = path.join(outputDir, filename);
        
        // Contenu enrichi avec métadonnées
        const enrichedContent = `=== MÉTADONNÉES CHUNK ===
Période: ${chunk.metadata.dateStart} → ${chunk.metadata.dateEnd}
Participants: ${chunk.metadata.participants.join(', ')}
Topics: ${chunk.metadata.topics.join(', ')}
Tokens: ${chunk.metadata.tokenCount}
Messages: ${chunk.metadata.messageCount}

=== CONTENU ===
${chunk.content}`;

        fs.writeFileSync(filepath, enrichedContent, 'utf-8');
        console.log(`✅ Sauvé: ${filename} (${chunk.metadata.tokenCount} tokens)`);
      }
      
      console.log(`\n✅ ${chunks.length} chunks sauvegardés dans ${outputDir}/`);
      return outputDir;
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      throw error;
    }
  }
}

export { TemporalChunker };