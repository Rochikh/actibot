# 🤖 ActiBot

ActiBot est un assistant conversationnel IA multilingue qui intègre l'API Assistant d'OpenAI pour servir les communautés WhatsApp "Iarena Educative" et "Dialogue actif". Il se spécialise dans la récupération précise d'informations spécifiques issues des discussions WhatsApp avec un contexte temporel précis.

## 🎯 Fonctionnalités Principales

- **Assistant IA Conversationnel** : Intégration complète avec l'API OpenAI Assistant
- **Recherche Sémantique Avancée** : Chunking temporel Claude 4.0 pour préserver la continuité conversationnelle
- **Traitement de Documents** : Pipeline automatisé pour les exports WhatsApp
- **Interface Web Moderne** : React + TypeScript avec composants shadcn/ui
- **Base de Données Vectorielle** : pgvector pour la recherche sémantique
- **Authentification** : Système d'admin avec gestion des utilisateurs

## 🏗️ Architecture

### Stack Technique
- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** : Node.js, Express, TypeScript
- **Base de Données** : PostgreSQL avec extension pgvector
- **ORM** : Drizzle ORM
- **IA** : OpenAI API (GPT-4o, embeddings, Assistant API)
- **Authentification** : Passport.js avec stratégie locale

### Structure du Projet
```
actibot/
├── client/                 # Application React
│   ├── src/
│   │   ├── components/     # Composants UI réutilisables
│   │   ├── pages/         # Pages de l'application
│   │   ├── hooks/         # Hooks React personnalisés
│   │   └── lib/           # Utilitaires et configuration
├── server/                # API Express
│   ├── index.ts           # Point d'entrée du serveur
│   ├── routes.ts          # Routes API
│   ├── auth.ts            # Système d'authentification
│   ├── openai.ts          # Intégration OpenAI
│   ├── temporal-chunking.js    # Système de chunking temporel
│   └── upload-temporal-chunks.js # Upload vers Vector Store
├── db/                    # Schéma et configuration DB
│   └── schema.ts          # Modèles Drizzle
└── temporal_chunks/       # Chunks temporels générés
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- PostgreSQL avec extension pgvector
- Clé API OpenAI
- Assistant OpenAI configuré

### Configuration
1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/actibot.git
cd actibot
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```env
DATABASE_URL=postgresql://username:password@host:port/database
OPENAI_API_KEY=sk-your-openai-api-key
SESSION_SECRET=your-random-session-secret
SENDGRID_API_KEY=SG-your-sendgrid-key (optionnel)
SENDGRID_FROM_EMAIL=your-email@domain.com (optionnel)
```

4. **Initialiser la base de données**
```bash
npm run db:push
```

5. **Démarrer l'application**
```bash
npm run dev
```

## 📊 Chunking Temporel Claude 4.0

ActiBot utilise un système de chunking temporel avancé qui :
- **Préserve la continuité conversationnelle** des discussions WhatsApp
- **Maintient le contexte temporel** avec métadonnées par chunk
- **Optimise la recherche sémantique** sur toute la période (oct 2023 → présent)
- **Génère 2320+ chunks** de 400-600 tokens avec overlap de 50-100 tokens

### Mise à Jour des Données WhatsApp
```bash
# Placer le nouveau fichier WhatsApp dans attached_assets/
node update-whatsapp-weekly.js
```

## 🔧 Commandes Utiles

```bash
# Développement
npm run dev              # Démarre frontend + backend
npm run db:push          # Synchronise le schéma DB
npm run db:studio        # Interface Drizzle Studio

# Production
npm run build           # Build optimisé
npm start              # Démarre en production

# Maintenance
node server/diagnose-vector-store.js    # Diagnostic Vector Store
node test-temporal-chunking.js          # Test du chunking
```

## 🎛️ Configuration Assistant OpenAI

L'application nécessite un Assistant OpenAI configuré avec :
- **Modèle** : gpt-4o-mini
- **File Search** activé
- **Vector Store** attaché avec les chunks temporels
- **Instructions système** pour le contexte WhatsApp

## 🔐 Authentification

- **Compte admin par défaut** : username `admin`, password `admin`
- **Sessions sécurisées** avec express-session
- **Gestion des rôles** pour l'accès aux fonctionnalités admin

## 📱 Interface Utilisateur

- **Design responsive** adapté mobile/desktop
- **Chat en temps réel** avec l'assistant IA
- **Panel administrateur** pour la gestion des documents
- **Interface moderne** avec composants shadcn/ui

## 🌍 Déploiement

ActiBot est optimisé pour le déploiement sur :
- **Replit** (configuration actuelle)
- **bolt.new** (migration possible)
- **Vercel/Netlify** (avec base de données externe)
- **Docker** (configuration disponible)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :
1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commiter les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## 📞 Support

Pour toute question ou problème :
- Ouvrir une issue GitHub
- Consulter la documentation dans `/docs`
- Vérifier les logs avec les outils de diagnostic inclus

---

**ActiBot** - Assistant IA conversationnel pour communautés WhatsApp