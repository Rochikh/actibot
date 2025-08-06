# 📋 Étapes Manuelles pour GitHub Repository

## ✅ Fichiers Préparés
- `.gitignore` : Exclusions appropriées (node_modules, .env, gros fichiers)
- `README.md` : Documentation complète du projet
- `.gitkeep` : Marqueurs pour dossiers vides

## 🔧 Étapes à Suivre Manuellement

### 1. Initialiser Git (Dans le Shell Replit)
```bash
# Si git n'est pas encore initialisé
git init

# Vérifier le statut
git status
```

### 2. Ajouter les Fichiers
```bash
# Ajouter tous les fichiers (sauf exclusions .gitignore)
git add .

# Vérifier ce qui sera commité
git status
```

### 3. Premier Commit
```bash
git commit -m "Initial ActiBot commit - Ready for migration to bolt.new

✅ Features:
- Temporal chunking Claude 4.0 system
- OpenAI Assistant API integration  
- WhatsApp discussion processing
- React + TypeScript frontend
- Express + PostgreSQL backend
- Vector Store optimization (2320+ chunks)

🔧 Ready for import in bolt.new via GitHub"
```

### 4. Créer Repository GitHub
1. **Aller sur** https://github.com
2. **Cliquer** "New repository"
3. **Nom** : `actibot` 
4. **Description** : `Assistant IA conversationnel pour communautés WhatsApp avec chunking temporel`
5. **Public** ou **Private** (au choix)
6. **Ne pas** initialiser avec README (on a déjà le nôtre)
7. **Créer** le repository

### 5. Connecter à GitHub
```bash
# Remplacer YOUR-USERNAME par ton username GitHub
git remote add origin https://github.com/YOUR-USERNAME/actibot.git

# Définir la branche principale
git branch -M main

# Premier push
git push -u origin main
```

### 6. Vérifier sur GitHub
- Repository visible avec tous les fichiers
- README.md s'affiche correctement
- Structure des dossiers préservée
- .gitignore fonctionne (pas de node_modules, etc.)

## 📁 Fichiers Exclus du Git (Normal)
- `attached_assets/*.txt` : Fichiers WhatsApp (seront re-uploadés)
- `temporal_chunks/*.txt` : Chunks générés (recréés automatiquement)
- `node_modules/` : Dépendances (npm install les restaure)
- `.env` : Variables d'environnement (à reconfigurer sur bolt.new)

## 🔍 Vérifications Finales
- [ ] Repository GitHub créé et accessible
- [ ] Tous les fichiers source présents
- [ ] README.md complet et lisible
- [ ] Structure des dossiers préservée
- [ ] Prêt pour import dans bolt.new

## ⚡ Après GitHub
1. **Aller sur bolt.new**
2. **"Import from GitHub"**
3. **URL** : `https://github.com/YOUR-USERNAME/actibot`
4. **bolt.new clone automatiquement** tout le projet
5. **Configurer les variables d'environnement**
6. **Lancer** `npm install && npm run dev`

---
*Repository prêt pour migration vers bolt.new*