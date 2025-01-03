import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemPrompts = pgTable("system_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  model: text("model").default("gpt-4o").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  response: text("response").notNull(),
  systemPromptId: integer("system_prompt_id").references(() => systemPrompts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema validation
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  email: z.string().email("L'adresse email n'est pas valide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schéma de connexion simplifié
export const loginUserSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

// Liste des modèles OpenAI disponibles
export const OPENAI_MODELS = [
  "gpt-4o",       // Le plus récent et performant
  "gpt-4o-mini", // Abordable et intelligent pour les tâches légères
  "gpt-3.5-turbo", // Bon équilibre performance/coût
  "gpt-4-vision-preview", // Pour l'analyse d'images
  "gpt-4",        // Version standard de GPT-4
  "gpt-3.5-turbo-16k", // Pour les longs contextes
] as const;

export const systemPromptSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  content: z.string().min(1, "Le contenu est requis"),
  model: z.enum(OPENAI_MODELS, {
    required_error: "Le modèle est requis",
    invalid_type_error: "Modèle invalide",
  }),
});

export const selectUserSchema = createSelectSchema(users);

export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);

export const insertSystemPromptSchema = createInsertSchema(systemPrompts).merge(systemPromptSchema);
export const selectSystemPromptSchema = createSelectSchema(systemPrompts);

export const insertChatSchema = createInsertSchema(chats);
export const selectChatSchema = createSelectSchema(chats);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = typeof chats.$inferInsert;
export type OpenAIModel = typeof OPENAI_MODELS[number];