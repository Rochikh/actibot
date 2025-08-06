# 🚀 Migration ActiBot vers Bolt.new

## Prérequis
- Compte bolt.new
- Accès aux clés API OpenAI
- Fichiers WhatsApp exportés

## Étapes de Migration

### 1. Préparation des Fichiers
```bash
# Créer un archive des fichiers essentiels
zip -r actibot-migration.zip \
  client/ \
  server/ \
  db/ \
  package.json \
  tsconfig.json \
  tailwind.config.ts \
  vite.config.ts \
  drizzle.config.ts \
  theme.json
```

### 2. Structure à Recréer sur Bolt
```
actibot/
├── package.json                 # Dépendances principales
├── tsconfig.json               # Configuration TypeScript
├── vite.config.ts              # Configuration Vite
├── tailwind.config.ts          # Configuration Tailwind
├── drizzle.config.ts           # Configuration DB
├── theme.json                  # Thème shadcn
├── client/                     # Frontend React
│   ├── src/
│   │   ├── components/         # Composants UI
│   │   ├── pages/             # Pages de l'app
│   │   ├── hooks/             # Hooks React
│   │   └── lib/               # Utilitaires
├── server/                     # Backend Express
│   ├── index.ts               # Point d'entrée
│   ├── routes.ts              # API routes
│   ├── auth.ts                # Authentification
│   ├── openai.ts              # Integration OpenAI
│   ├── temporal-chunking.js   # Chunking temporel
│   └── upload-temporal-chunks.js
└── db/                        # Schema base de données
    └── schema.ts
```

### 3. Variables d'Environnement à Configurer
```env
# À ajouter dans bolt.new
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
SESSION_SECRET=random-secret-key
SENDGRID_API_KEY=SG-... (optionnel)
SENDGRID_FROM_EMAIL=email@domain.com (optionnel)
```

### 4. Commandes d'Installation
```bash
# Dans bolt.new terminal
npm install

# Configuration base de données
npm run db:push

# Démarrage
npm run dev
```

### 5. Migration des Données WhatsApp

#### Option A: Fichier Direct
1. Upload le fichier WhatsApp dans `attached_assets/`
2. Lancer: `node update-whatsapp-weekly.js`

#### Option B: Chunks Pré-générés
1. Copier le dossier `temporal_chunks/`
2. Lancer: `node server/upload-temporal-chunks.js`

### 6. Configuration Assistant OpenAI
```javascript
// Dans bolt.new, configurer l'Assistant ID
const ASSISTANT_ID = "asst_JerNOWvyU63gex8p0z3gSv8r";

// Créer nouveau Vector Store si nécessaire
const vectorStore = await openai.beta.vectorStores.create({
  name: "ActiBot Bolt - " + new Date().toLocaleDateString()
});
```

## Différences bolt.new vs Replit

### Avantages bolt.new
- Interface plus moderne
- Meilleur support TypeScript/React
- Déploiement simplifié
- Performance potentiellement meilleure

### Points d'attention
- Configuration PostgreSQL différente
- Variables d'environnement à reconfigurer
- Assistant OpenAI à reconnecter
- Tests nécessaires après migration

## Checklist Migration
- [ ] Fichiers copiés
- [ ] Dépendances installées  
- [ ] Variables d'environnement configurées
- [ ] Base de données initialisée
- [ ] Fichiers WhatsApp uploadés
- [ ] Vector Store créé et connecté
- [ ] Assistant OpenAI fonctionnel
- [ ] Interface web accessible
- [ ] Tests de conversation réussis

## Commandes Utiles Bolt.new
```bash
# Vérifier l'état
npm run dev

# Reconstruire chunks
node update-whatsapp-weekly.js

# Test assistant
node server/diagnose-vector-store.js

# Migration DB
npm run db:push
```

## Support
En cas de problème lors de la migration :
1. Vérifier les logs console
2. Tester les clés API
3. Valider la connexion Vector Store
4. Recréer les chunks si nécessaire

---
*Guide créé pour migration depuis Replit vers bolt.new*