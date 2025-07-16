import { crypto } from './auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function fixAdminPassword() {
  try {
    // Hash du mot de passe "admin"
    const hashedPassword = await crypto.hash('admin');
    
    // Mettre à jour le mot de passe admin
    const result = await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, 'admin'))
      .returning();
    
    if (result.length > 0) {
      console.log('✅ Mot de passe admin mis à jour avec succès');
      console.log('Username: admin');
      console.log('Password: admin');
    } else {
      console.log('❌ Utilisateur admin non trouvé');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  process.exit(0);
}

fixAdminPassword();