# Template de Spécifications Techniques

## 1. Structure de Données

### Base de données
```typescript
// Exemple de schéma de base de données
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

// Autres tables et relations...
```

### Validation des données
```typescript
// Exemple de schémas de validation
export const userSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  email: z.string().email("L'adresse email n'est pas valide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});
```

## 2. Interface Utilisateur

### Thème
```json
{
  "variant": "tint",
  "primary": "hsl(45, 100%, 50%)",
  "appearance": "system",
  "radius": 0.75
}
```

### Pages requises
- [ ] Page d'authentification (login/register)
- [ ] Interface de chat
- [ ] Panel d'administration
- [ ] Autres pages spécifiques...

### Formatage des messages
Exemple de format Markdown supporté :
- Gras : **texte**
- Italique : *texte*
- Listes numérotées
- Emojis 🎯
- Autres styles...

## 3. Intégrations

### APIs requises
- [ ] OpenAI API (GPT-4)
- [ ] Autres APIs...

### Variables d'environnement
```env
OPENAI_API_KEY=
DATABASE_URL=
# Autres variables...
```

## 4. Fonctionnalités

### Authentication
- [ ] Inscription utilisateur
- [ ] Connexion
- [ ] Gestion des rôles (admin/user)
- [ ] Changement de mot de passe

### Chat
- [ ] Interface de conversation
- [ ] Historique des messages
- [ ] Formatage Markdown
- [ ] Intégration IA

### Administration
- [ ] Gestion des documents
- [ ] Configuration des prompts système
- [ ] Autres fonctionnalités admin...

## 5. Exemples de Messages

### Format des prompts système
```
Bienvenue au chat bot de la communauté WhatsApp ! 😊
Pour créer un **podcast en français**, voici quelques étapes :

1. **Planification** : Définis ton sujet
2. **Enregistrement** : Utilise un logiciel audio
3. **Édition** : Retouche ton enregistrement
```

### Format des réponses attendues
- Structure claire avec listes numérotées
- Utilisation appropriée du markdown
- Intégration naturelle des émojis
- Ton conversationnel adapté
