import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { documents, documentChunks, chats, systemPrompts, users, type User } from "@db/schema";
import { generateEmbedding, findSimilarDocuments, getChatResponse } from "./openai";
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

      // Get the active system prompt
      const [activePrompt] = await db.select()
        .from(systemPrompts)
        .where(eq(systemPrompts.isActive, true))
        .limit(1);

      // Get relevant documents for context
      const relevantDocs = await findSimilarDocuments(message.trim());
      const context = relevantDocs.map((doc: any) => doc.content).join("\n\n");

      // Get chat response
      const response = await getChatResponse(
        message,
        Array.isArray(history) ? history : []
      );

      // Save chat message
      const [chat] = await db.insert(chats).values({
        userId: req.user!.id,
        message: message.trim(),
        response,
        systemPromptId: activePrompt?.id
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
  
  // Public chat endpoint for embedding into external websites
  app.post("/api/public/chat", cors(corsOptions), async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      // Validate message
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).send("Le message ne peut pas être vide");
      }
      
      // Get the active system prompt
      const [activePrompt] = await db.select()
        .from(systemPrompts)
        .where(eq(systemPrompts.isActive, true))
        .limit(1);
        
      // Get relevant documents for context
      const relevantDocs = await findSimilarDocuments(message.trim());
      const context = relevantDocs.map((doc: any) => doc.content).join("\n\n");
        
      // Get chat response using the assistant
      const response = await getChatResponse(message, []);
        
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

  const httpServer = createServer(app);
  return httpServer;
}

// Fonction de traitement asynchrone
async function processDocument(documentId: number, content: string) {
  try {
    console.log(`Starting processing for document ${documentId}`);

    // Traitement par petits morceaux
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