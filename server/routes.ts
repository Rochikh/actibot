import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { documents, documentChunks, chats, systemPrompts, users, type User } from "@db/schema";
import { generateEmbedding, findSimilarDocuments, getChatResponse, chunkDocument } from "./openai";
import multer from "multer";
import { eq } from "drizzle-orm";
import { crypto } from "./auth";
import type { Request } from "express";
import { setupAuth } from "./auth";
import { Buffer } from "buffer";
import iconv from "iconv-lite";

interface AuthenticatedRequest extends Request {
  user?: User;
  isAuthenticated(): this is AuthenticatedRequest;
}

const upload = multer();

function detectAndDecodeText(buffer: Buffer): string {
  // First try UTF-8
  try {
    const utf8Text = buffer.toString('utf-8');
    // Verify it's valid UTF-8
    if (Buffer.from(utf8Text).toString('utf-8') === utf8Text) {
      console.log('File detected as UTF-8');
      return utf8Text;
    }
  } catch (e) {
    console.log('Not valid UTF-8, trying other encodings');
  }

  // Try other common encodings
  const encodings = ['utf-16le', 'utf-16be', 'iso-8859-1', 'windows-1252'];
  for (const encoding of encodings) {
    try {
      const decodedText = iconv.decode(buffer, encoding);
      console.log(`File decoded using ${encoding}`);
      return decodedText;
    } catch (e) {
      console.log(`Failed to decode with ${encoding}`);
    }
  }

  // If all else fails, try to clean the buffer of null bytes and decode as UTF-8
  const cleanBuffer = Buffer.from(buffer.filter(byte => byte !== 0x00));
  return cleanBuffer.toString('utf-8');
}

export function registerRoutes(app: Express): Server {
  // Set up authentication routes and middleware
  setupAuth(app);

  // Middleware to check if user is authenticated
  const requireAuth = (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Non authentifié");
    }
    next();
  };

  // Middleware to check if user is admin
  const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Accès administrateur requis");
    }
    next();
  };

  // Document management routes (protected by auth and admin)
  app.post("/api/documents", requireAuth, requireAdmin, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send("Aucun fichier n'a été téléchargé");
      }

      console.log(`Processing uploaded file: ${file.originalname}, size: ${file.size} bytes`);

      // Detect and decode the file content
      const content = detectAndDecodeText(file.buffer);

      if (!content.trim()) {
        return res.status(400).send("Le fichier est vide ou ne contient pas de texte valide");
      }

      console.log(`Successfully decoded file content, length: ${content.length} characters`);

      // Create the document first
      const [document] = await db.insert(documents).values({
        title: file.originalname,
        content: content,
        uploadedBy: req.user!.id
      }).returning();

      console.log(`Created document with ID: ${document.id}`);

      // Process the document in chunks
      const chunks = chunkDocument(content);
      console.log(`Split document into ${chunks.length} chunks`);

      // Generate embeddings and save chunks
      for (const chunk of chunks) {
        try {
          console.log(`Processing chunk of length: ${chunk.content.length}`);
          const embedding = await generateEmbedding(chunk.content);

          await db.insert(documentChunks).values({
            documentId: document.id,
            content: chunk.content,
            embedding,
            chunkIndex: chunks.indexOf(chunk),
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            metadata: chunk.metadata
          });
        } catch (error) {
          console.error("Error processing chunk:", error);
          // Continue processing other chunks even if one fails
        }
      }

      res.json(document);
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/documents", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const allDocuments = await db.select().from(documents);
      res.json(allDocuments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/documents/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Delete associated chunks first
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

  // System Prompts routes (protected by auth and admin)
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

  // Modified Chat routes to include system prompt and history
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
        context,
        activePrompt?.content,
        Array.isArray(history) ? history : [],
        activePrompt?.model
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

  const httpServer = createServer(app);
  return httpServer;
}