# 📤 Upload Manuel vers GitHub (Solution Alternative)

## Problème Rencontré
- Verrouillage Git empêche les commandes automatiques
- Repository "actibotnew" est vide car connexion vers ancien repo

## ✅ Solution Manuelle Simple

### Étape 1: Préparer les Fichiers Clés
Les fichiers les plus importants à transférer manuellement :

**Fichiers Configuration (Racine):**
- `package.json`
- `tsconfig.json` 
- `vite.config.ts`
- `tailwind.config.ts`
- `drizzle.config.ts`
- `theme.json`
- `README.md`
- `.gitignore`

**Dossiers Structure:**
- `client/src/` (tout le contenu)
- `server/` (tout le contenu)
- `db/schema.ts`

### Étape 2: Upload via Interface GitHub

1. **Aller sur** https://github.com/Rochikh/actibotnew
2. **Cliquer** "Add file" → "Upload files"
3. **Drag & drop** ou sélectionner les fichiers depuis Replit
4. **Commiter** avec message : "Initial ActiBot upload"

### Étape 3: Créer Structure Dossiers

Dans GitHub, créer les dossiers manquants :
- `client/src/components/`
- `client/src/pages/`
- `client/src/hooks/`
- `client/src/lib/`
- `server/`
- `db/`

### Étape 4: Copier-Coller Contenu Important

**Fichiers prioritaires à copier depuis Replit:**

1. **package.json** (toutes les dépendances)
2. **server/index.ts** (serveur principal)
3. **server/routes.ts** (API routes)
4. **server/auth.ts** (authentification)
5. **server/openai.ts** (intégration OpenAI)
6. **server/temporal-chunking.js** (chunking temporel)
7. **server/upload-temporal-chunks.js** (upload Vector Store)
8. **client/src/App.tsx** (app principale)
9. **client/src/main.tsx** (point d'entrée)
10. **db/schema.ts** (schéma base de données)

## 🎯 Après Upload Manuel

Une fois les fichiers sur GitHub :

1. **bolt.new** → "Import from GitHub"
2. **URL** : `https://github.com/Rochikh/actibotnew`
3. **bolt.new clone** automatiquement
4. **npm install** pour restaurer node_modules
5. **Configuration** variables d'environnement
6. **npm run dev** pour démarrer

## ⚡ Avantages Upload Manuel

- Contourne les problèmes Git
- Contrôle total sur les fichiers
- Plus rapide que debugging Git
- Résultat identique pour bolt.new

## 📋 Checklist Upload

- [ ] package.json uploadé
- [ ] Dossier server/ complet
- [ ] Dossier client/src/ complet
- [ ] db/schema.ts présent
- [ ] Configuration files (vite, tailwind, etc.)
- [ ] README.md visible sur GitHub
- [ ] Prêt pour import bolt.new

---
*Solution alternative quand Git pose problème*