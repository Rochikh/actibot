import { crypto } from './auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function resetAdminPassword() {
  try {
    const newPasswordHash = await crypto.hash('admin');
    await db.update(users)
      .set({ password: newPasswordHash })
      .where(eq(users.username, 'admin'));
    console.log('✅ Mot de passe admin réinitialisé à "admin"');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

resetAdminPassword();