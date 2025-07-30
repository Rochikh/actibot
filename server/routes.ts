import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { documents, documentChunks, chats, systemPrompts, users, type User } from "@db/schema";
import { generateEmbedding, findSimilarDocuments, getChatResponse } from "./openai";
import { autoSplitAndUpload, shouldSplitFile } from "./auto-split-files.js";
import { manageUpdate, analyzeContentDifferences } from "./update-manager.js";
import multer from "multer";
import { eq } from "drizzle-orm";
import { setupAuth } from "./auth";
import cors from "cors";

declare global {
  namespace Express {
    interface User extends Omit<import('@db/schema').User, never> {}
  }
}

interface AuthenticatedRequest extends Request {
  user?: User;
  isAuthenticated(): boolean;
}

// Configuration de multer avec des limites
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Route simple pour l'upload de documents
export function registerRoutes(app: Express): Server {
  setupAuth(app);
  
  // Enable CORS for public API endpoint
  const corsOptions = {
    origin: ['https://ia.rochane.fr', 'http://localhost:3000'],
    methods: ['POST', 'OPTIONS'],
    credentials: false,
    optionsSuccessStatus: 200
  };

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Non authentifié");
    }
    next();
  };

  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Accès administrateur requis");
    }
    next();
  };

  app.post("/api/documents", requireAuth, requireAdmin, upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("Starting document upload...");

      if (!req.file) {
        return res.status(400).send("Aucun fichier n'a été téléchargé");
      }

      const file = req.file;
      console.log(`File received: ${file.originalname}, size: ${file.size} bytes`);

      // Conversion simple en texte avec nettoyage minimal
      let content = file.buffer.toString().replace(/\0/g, ' ').trim();

      // Vérification basique
      if (!content) {
        return res.status(400).send("Le fichier est vide");
      }

      // Création du document sans le contenu complet
      const [document] = await db.insert(documents).values({
        title: file.originalname,
        content: content.slice(0, 1000), // Stocke juste le début pour référence
        uploadedBy: req.user!.id
      }).returning();

      // Répondre immédiatement
      res.json({ 
        message: "Document reçu avec succès", 
        document: { 
          id: document.id, 
          title: document.title 
        } 
      });

      // Traitement en arrière-plan
      setTimeout(() => {
        processDocument(document.id, content).catch(console.error);
      }, 0);

    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).send("Une erreur est survenue lors de l'upload");
    }
  });

  app.get("/api/documents", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allDocuments = await db.select().from(documents);
      res.json(allDocuments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/documents/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await db.delete(documentChunks)
        .where(eq(documentChunks.documentId, parseInt(req.params.id)));

      const [deletedDoc] = await db.delete(documents)
        .where(eq(documents.id, parseInt(req.params.id)))
        .returning();

      if (!deletedDoc) {
        return res.status(404).send("Document non trouvé");
      }

      res.json({ message: "Document supprimé avec succès" });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Autres routes restent inchangées...
  app.post("/api/system-prompts", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, content, model } = req.body;

      const [prompt] = await db.insert(systemPrompts).values({
        name,
        content,
        model: model || "gpt-4o",
        createdBy: req.user!.id,
        isActive: false
      }).returning();

      res.json(prompt);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/system-prompts", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const prompts = await db.select().from(systemPrompts);
      res.json(prompts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/system-prompts/:id/activate", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // First, deactivate all prompts
      await db.update(systemPrompts)
        .set({ isActive: false })
        .where(eq(systemPrompts.isActive, true));

      // Then activate the selected prompt
      const [updatedPrompt] = await db.update(systemPrompts)
        .set({ isActive: true })
        .where(eq(systemPrompts.id, parseInt(req.params.id)))
        .returning();

      res.json(updatedPrompt);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/system-prompts/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, content, model } = req.body;

      // Update the prompt
      const [updatedPrompt] = await db.update(systemPrompts)
        .set({
          name,
          content,
          model: model || "gpt-4o",
          updatedAt: new Date()
        })
        .where(eq(systemPrompts.id, parseInt(req.params.id)))
        .returning();

      if (!updatedPrompt) {
        return res.status(404).send("Prompt système non trouvé");
      }

      res.json(updatedPrompt);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { message, history } = req.body;

      // Validate message
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).send("Le message ne peut pas être vide");
      }

      // Get chat response using OpenAI Assistant directly
      const response = await getChatResponse(
        message.trim(),
        Array.isArray(history) ? history : []
      );

      // Save chat message
      const [chat] = await db.insert(chats).values({
        userId: req.user!.id,
        message: message.trim(),
        response,
        systemPromptId: null
      }).returning();

      res.json(chat);
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors du traitement du message");
    }
  });

  app.post("/api/chat/clear", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await db.delete(chats).where(eq(chats.userId, req.user!.id));
      res.json({ message: "Chat history cleared" });
    } catch (error: any) {
      console.error("Clear chat error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors de la suppression de l'historique");
    }
  });

  app.get("/api/chat/history", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const history = await db.select()
        .from(chats)
        .where(eq(chats.userId, req.user!.id))
        .orderBy(chats.createdAt);

      res.json(history);
    } catch (error: any) {
      console.error("Get chat history error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors de la récupération de l'historique");
    }
  });
  
  // Enable CORS for all public endpoints
  app.options('/api/public/*', cors(corsOptions));
  
  // Serve the embed script with CORS enabled
  app.get("/actibot-embed.js", cors(corsOptions), (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile('actibot-embed.js', { root: './client/src' });
  });
  
  // Serve the embed test HTML page
  app.get("/embed-test", (req: Request, res: Response) => {
    res.sendFile('embed-test.html', { root: './client/src' });
  });
  
  // Serve the test HTML page
  app.get("/test-actibot.html", (req: Request, res: Response) => {
    res.sendFile('test-actibot.html', { root: './public' });
  });
  
  // Serve the test chat page - avant les routes React
  app.get("/api/actibot-test", (req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ActiBot Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .chat-container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; max-height: 400px; overflow-y: auto; }
        .message { margin: 10px 0; padding: 10px; border-radius: 8px; }
        .user { background-color: #e3f2fd; text-align: right; }
        .bot { background-color: #f5f5f5; }
        .input-container { display: flex; gap: 10px; margin-top: 20px; }
        input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:disabled { background-color: #ccc; }
        .loading { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>ActiBot Test - Nouvelles Données Juillet 2025</h1>
    
    <div class="chat-container" id="chat">
        <div class="message bot">
            <strong>ActiBot:</strong> Bonjour ! Je peux maintenant accéder aux discussions jusqu'au 30 juillet 2025. Posez-moi vos questions sur NotebookLM, les nouvelles ressources ou toute autre information récente !
        </div>
    </div>
    
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Ex: Peut-on générer des vidéos avec NotebookLM ?" />
        <button onclick="sendMessage()" id="sendBtn">Envoyer</button>
    </div>
    
    <script>
        function addMessage(content, isUser = false) {
            const chat = document.getElementById('chat');
            const message = document.createElement('div');
            message.className = \`message \${isUser ? 'user' : 'bot'}\`;
            message.innerHTML = \`<strong>\${isUser ? 'Vous' : 'ActiBot'}:</strong> \${content}\`;
            chat.appendChild(message);
            chat.scrollTop = chat.scrollHeight;
        }
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const button = document.getElementById('sendBtn');
            const message = input.value.trim();
            
            if (!message) return;
            
            addMessage(message, true);
            input.value = '';
            button.disabled = true;
            
            addMessage('<span class="loading">Recherche dans les données juillet 2025...</span>');
            
            try {
                const response = await fetch('/api/test/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                
                // Supprimer le message de chargement
                const lastMessage = document.querySelector('.chat-container .message:last-child');
                lastMessage.remove();
                
                addMessage(data.response);
            } catch (error) {
                const lastMessage = document.querySelector('.chat-container .message:last-child');
                lastMessage.remove();
                addMessage('Erreur lors du traitement de la requête.');
            }
            
            button.disabled = false;
        }
        
        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>`);
  });
  
  // Public chat endpoint for embedding into external websites
  app.post("/api/public/chat", cors(corsOptions), async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      // Validate message
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).send("Le message ne peut pas être vide");
      }
      
      console.log("Public chat request:", message.trim());
      
      // Get chat response using OpenAI Assistant directly
      const response = await getChatResponse(message.trim(), []);
      
      console.log("Public chat response:", response.substring(0, 200) + "...");
        
      res.json({ 
        message: message.trim(),
        response,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error("Public chat error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors du traitement du message");
    }
  });

  // Test endpoint non-authentifié pour déboguer
  app.post("/api/test/chat", cors(corsOptions), async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).send("Le message ne peut pas être vide");
      }
      
      console.log("Test chat request:", message.trim());
      
      const response = await getChatResponse(message.trim(), []);
      
      console.log("Test chat response:", response.substring(0, 200) + "...");
        
      res.json({ 
        message: message.trim(),
        response,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error("Test chat error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors du traitement du message");
    }
  });

  // Route pour la division manuelle
  app.post("/api/admin/auto-split", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Test avec le fichier WhatsApp existant
      const fs = await import('fs');
      const whatsappFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
      
      if (!fs.existsSync(whatsappFile)) {
        return res.status(404).send("Fichier WhatsApp non trouvé");
      }

      const content = fs.readFileSync(whatsappFile, 'utf-8');
      const result = await autoSplitAndUpload(content, 'Discussion WhatsApp avec Ai-Dialogue Actif.txt');
      
      if (result) {
        res.json(result);
      } else {
        res.status(500).send("Erreur lors de la division automatique");
      }
    } catch (error: any) {
      console.error("Auto-split error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors de la division");
    }
  });

  // Route pour analyser les changements avant mise à jour
  app.post("/api/admin/analyze-update", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fs = await import('fs');
      const currentFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
      
      if (!fs.existsSync(currentFile)) {
        return res.status(404).send("Fichier WhatsApp non trouvé");
      }

      const currentContent = fs.readFileSync(currentFile, 'utf-8');
      
      // Simuler un nouveau contenu (en pratique, tu uploaderais un nouveau fichier)
      const newContent = currentContent + '\n\n-- Nouvelles discussions simulées --\n' + 
                        Array(100).fill().map((_, i) => `${new Date().toLocaleDateString()}, 10:${String(i % 60).padStart(2, '0')} - Test: Message ${i + 1}`).join('\n');
      
      const stats = analyzeContentDifferences(currentContent, newContent);
      
      const recommendation = {
        recommended: stats.percentageIncrease < 20 ? 'incremental' : 'full_replacement',
        reason: `Augmentation de ${stats.percentageIncrease}% du contenu`
      };

      res.json({
        stats,
        recommendation
      });
    } catch (error: any) {
      console.error("Analyze update error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors de l'analyse");
    }
  });

  // Route pour lancer la mise à jour
  app.post("/api/admin/update-content", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { updateType } = req.body;
      const fs = await import('fs');
      const currentFile = '../attached_assets/Discussion WhatsApp avec 🔁Ai-Dialogue Actif_1752670591921.txt';
      
      if (!fs.existsSync(currentFile)) {
        return res.status(404).send("Fichier WhatsApp non trouvé");
      }

      const currentContent = fs.readFileSync(currentFile, 'utf-8');
      
      // Simuler un nouveau contenu (en pratique, tu uploaderais un nouveau fichier)
      const newContent = currentContent + '\n\n-- Nouvelles discussions --\n' + 
                        Array(50).fill().map((_, i) => `${new Date().toLocaleDateString()}, 10:${String(i % 60).padStart(2, '0')} - Nouveau: Message ${i + 1}`).join('\n');
      
      const result = await manageUpdate(currentFile, 'temp-new-content.txt', updateType);
      
      // Écrire temporairement le nouveau contenu pour le test
      fs.writeFileSync('temp-new-content.txt', newContent);
      
      const updateResult = await manageUpdate(currentFile, 'temp-new-content.txt', updateType);
      
      // Nettoyer le fichier temporaire
      fs.unlinkSync('temp-new-content.txt');
      
      if (updateResult) {
        res.json(updateResult);
      } else {
        res.status(500).send("Erreur lors de la mise à jour");
      }
    } catch (error: any) {
      console.error("Update content error:", error);
      res.status(500).send(error.message || "Une erreur est survenue lors de la mise à jour");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Fonction de traitement asynchrone avec auto-division
async function processDocument(documentId: number, content: string) {
  try {
    console.log(`Starting processing for document ${documentId}`);

    // Récupérer le document pour obtenir le nom du fichier
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!document) {
      console.error(`Document ${documentId} not found`);
      return;
    }

    // Vérifier si le fichier doit être divisé (pour OpenAI Assistant)
    if (shouldSplitFile(content)) {
      console.log(`📦 Fichier ${document.title} nécessite une division pour OpenAI Assistant`);
      
      try {
        const splitResult = await autoSplitAndUpload(content, document.title);
        if (splitResult) {
          console.log(`✅ Division terminée: ${splitResult.chunksCreated} chunks créés pour OpenAI Assistant`);
          
          // Mettre à jour le document pour indiquer qu'il a été divisé
          await db.update(documents)
            .set({ 
              content: `${document.content}\n\n[Auto-divisé en ${splitResult.chunksCreated} parties pour OpenAI Assistant]`
            })
            .where(eq(documents.id, documentId));
        }
      } catch (error) {
        console.error(`Erreur lors de la division automatique:`, error);
      }
    }

    // Traitement par petits morceaux pour la base de données locale (recherche sémantique)
    const chunkSize = 1000;
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      try {
        const embedding = await generateEmbedding(chunk);

        await db.insert(documentChunks).values({
          documentId,
          content: chunk,
          embedding,
          chunkIndex: Math.floor(i / chunkSize),
          startOffset: i,
          endOffset: i + chunk.length,
          metadata: { position: i === 0 ? 'start' : i + chunkSize >= content.length ? 'end' : 'middle' }
        });

        console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1}`);
      } catch (error) {
        console.error(`Error processing chunk at offset ${i}:`, error);
        // Continue avec le prochain chunk
      }
    }

    console.log(`Finished processing document ${documentId}`);
  } catch (error) {
    console.error(`Failed to process document ${documentId}:`, error);
  }
}