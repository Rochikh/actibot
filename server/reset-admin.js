import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function resetAdminPassword() {
  try {
    console.log('🔄 Réinitialisation du mot de passe admin...');
    
    // Hacher le mot de passe "admin" 
    const hashedPassword = await hashPassword("admin");
    
    // Mettre à jour l'utilisateur admin existant
    const result = await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, 'admin'))
      .returning();
    
    if (result.length > 0) {
      console.log('✅ Mot de passe admin réinitialisé avec succès');
      console.log('📝 Identifiants :');
      console.log('   Username: admin');
      console.log('   Password: admin');
    } else {
      console.log('❌ Utilisateur admin non trouvé');
      
      // Créer un nouvel utilisateur admin
      const newAdmin = await db.insert(users)
        .values({
          username: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
          isAdmin: true
        })
        .returning();
      
      console.log('✅ Nouvel utilisateur admin créé');
      console.log('📝 Identifiants :');
      console.log('   Username: admin');
      console.log('   Password: admin');
    }
    
    console.log('🔐 Tu peux maintenant te connecter avec admin/admin');
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error.message);
  }
  
  process.exit(0);
}

resetAdminPassword();