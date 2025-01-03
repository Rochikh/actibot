import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type User as SelectUser, loginUserSchema } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

async function createDefaultAdminIfNotExists() {
  try {
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (!existingAdmin) {
      const hashedPassword = await crypto.hash("admin"); // Default password is 'admin'
      await db.insert(users).values({
        username: "admin",
        email: "admin@example.com",
        password: hashedPassword,
        isAdmin: true,
      });
      console.log("Default admin account created");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export async function setupAuth(app: Express) {
  // Create default admin account
  await createDefaultAdminIfNotExists();

  const MemoryStore = createMemoryStore(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    resave: true,
    saveUninitialized: true,
    name: 'sessionId',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      stale: false,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    if (sessionSettings.cookie) {
      sessionSettings.cookie.secure = true;
    }
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("Deserializing user:", id);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log("User not found during deserialization:", id);
        return done(null, false);
      }

      console.log("User found during deserialization:", user.id);
      done(null, user);
    } catch (err) {
      console.error("Error during deserialization:", err);
      done(err);
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for username:", username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log("User not found:", username);
          return done(null, false, { message: "Nom d'utilisateur incorrect" });
        }

        console.log("User found, verifying password");
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log("Password verification failed");
          return done(null, false, { message: "Mot de passe incorrect" });
        }

        console.log("Login successful for user:", user.username);
        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    })
  );

  app.post("/api/login", (req, res, next) => {
    const result = loginUserSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .send("Données invalides : " + result.error.issues.map((i) => i.message).join(", "));
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        console.error("Authentication error:", err);
        return next(err);
      }

      if (!user) {
        console.log("Authentication failed:", info.message);
        return res.status(400).send(info.message ?? "La connexion a échoué");
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return next(err);
        }

        console.log("Login successful for user:", user.username);
        return res.json({
          message: "Connexion réussie",
          user: { 
            id: user.id, 
            username: user.username, 
            isAdmin: user.isAdmin,
            email: user.email 
          },
        });
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Données invalides : " + result.error.issues.map((i) => i.message).join(", "));
      }

      const { username, email, password } = result.data;

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).send("Ce nom d'utilisateur existe déjà");
      }

      // Check if email already exists
      const [existingEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail) {
        return res.status(400).send("Cette adresse email est déjà utilisée");
      }

      // Hash the password
      const hashedPassword = await crypto.hash(password);

      // Vérifier s'il existe déjà des utilisateurs
      const userCount = await db.select({ count: sql<number>`count(*)::integer` }).from(users);
      const isFirstUser = userCount[0].count === 0;

      console.log("User count:", userCount[0].count, "Is first user:", isFirstUser);

      // Create the new user
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
          isAdmin: isFirstUser, // Le premier utilisateur sera admin
        })
        .returning();

      // Send confirmation email
      try {
        await sendConfirmationEmail(email, username);
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Continue with registration even if email fails
      }

      // Log the user in after registration
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Inscription réussie",
          user: { 
            id: newUser.id, 
            username: newUser.username, 
            isAdmin: newUser.isAdmin,
            email: newUser.email
          },
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("La déconnexion a échoué");
      }

      res.json({ message: "Déconnexion réussie" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      console.log("User is authenticated:", req.user);
      return res.json(req.user);
    }
    console.log("User is not authenticated");
    res.status(401).send("Non connecté");
  });
}