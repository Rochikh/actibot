import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { documents, chats, systemPrompts } from "@db/schema";
import { generateEmbedding, findSimilarDocuments, getChatResponse } from "./openai";
import multer from "multer";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { setupAuth } from "./auth";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    isAdmin: boolean;
  }
}

const upload = multer();

export function registerRoutes(app: Express): Server {
  // Set up authentication routes and middleware
  setupAuth(app);

  // Middleware to check if user is authenticated
  const requireAuth = (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    next();
  };

  // Middleware to check if user is admin
  const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }
    next();
  };

  // Document management routes (protected by auth and admin)
  app.post("/api/documents", requireAuth, requireAdmin, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send("No file uploaded");
      }

      const content = file.buffer.toString("utf-8");
      const embedding = await generateEmbedding(content);

      const [document] = await db.insert(documents).values({
        title: file.originalname,
        content,
        embedding,
        uploadedBy: req.user!.id
      }).returning();

      res.json(document);
    } catch (error: any) {
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

  // System Prompts routes (protected by auth and admin)
  app.post("/api/system-prompts", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, content } = req.body;

      const [prompt] = await db.insert(systemPrompts).values({
        name,
        content,
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

  // Modified Chat routes to include system prompt
  app.post("/api/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { message } = req.body;

      // Get the active system prompt
      const [activePrompt] = await db.select()
        .from(systemPrompts)
        .where(eq(systemPrompts.isActive, true))
        .limit(1);

      const allDocuments = await db.select().from(documents);
      const relevantDocs = await findSimilarDocuments(allDocuments, message);
      const context = relevantDocs.map(doc => doc.content).join("\n\n");

      const response = await getChatResponse(
        message,
        context,
        activePrompt?.content
      );

      const [chat] = await db.insert(chats).values({
        userId: req.user!.id,
        message,
        response,
        systemPromptId: activePrompt?.id
      }).returning();

      res.json(chat);
    } catch (error: any) {
      res.status(500).send(error.message);
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
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}