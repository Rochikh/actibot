# 🚀 Migration ActiBot via GitHub → bolt.new

## Processus Simplifié avec GitHub

### Étape 1: Créer le Repository GitHub
```bash
# Dans Replit Shell
git init
git add .
git commit -m "Initial ActiBot commit - Ready for bolt.new"

# Créer un repo sur GitHub (interface web)
# Puis connecter:
git remote add origin https://github.com/ton-username/actibot.git
git branch -M main
git push -u origin main
```

### Étape 2: Import Direct dans bolt.new
1. **Aller sur bolt.new**
2. **Sélectionner "Import from GitHub"**
3. **Coller l'URL** : `https://github.com/ton-username/actibot`
4. **bolt.new clone automatiquement** tout le projet

## Avantages de cette Méthode

### ✅ Ce qui est Préservé Automatiquement
- **Structure complète** : dossiers, fichiers, organisation
- **Dépendances** : package.json avec toutes les libs installées
- **Configuration** : vite, tailwind, drizzle, typescript
- **Code source** : frontend, backend, schemas DB
- **Scripts** : chunking temporel, upload, mise à jour

### ✅ Synchronisation Automatique
- **Historique Git** : toutes les modifications trackées  
- **Branches** : possibilité de développer en parallèle
- **Collaboratif** : autres développeurs peuvent contribuer
- **Backup** : code sauvegardé sur GitHub

## Configuration Post-Import

### Variables d'Environnement (bolt.new)
```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
SESSION_SECRET=random-secret-key
SENDGRID_API_KEY=SG-... (optionnel)
```

### Commandes d'Installation
```bash
# bolt.new terminal (auto-détecté)
npm install
npm run db:push
npm run dev
```

### Reconfiguration Assistant OpenAI
```bash
# Créer nouveau Vector Store pour bolt.new
node update-whatsapp-weekly.js
```

## Workflow de Développement

### Développement Dual (Replit + bolt.new)
```bash
# Modifications sur Replit
git add .
git commit -m "Nouvelles fonctionnalités"
git push

# Sur bolt.new - Pull automatique ou manuel
git pull origin main
```

### Mise à Jour WhatsApp
1. **Upload nouveau fichier** sur n'importe quelle plateforme
2. **Commit et push** : `git push`
3. **Pull sur l'autre** : `git pull`
4. **Lancer mise à jour** : `node update-whatsapp-weekly.js`

## Comparaison des Approches

| Méthode | Facilité | Risque | Temps |
|---------|----------|---------|-------|
| **GitHub Import** | 🟢 Très facile | 🟢 Très faible | 🟢 15 min |
| Migration manuelle | 🟡 Moyenne | 🟡 Moyen | 🔴 2-3h |

## Commandes Pratiques

### Push depuis Replit
```bash
git add .
git commit -m "Update WhatsApp data $(date)"
git push
```

### Pull sur bolt.new
```bash
git pull origin main
npm install  # Si nouvelles dépendances
```

### Synchronisation des Données WhatsApp
```bash
# Après pull du nouveau fichier WhatsApp
node update-whatsapp-weekly.js
```

## Checklist Migration GitHub

- [ ] Repository GitHub créé
- [ ] Code pushé depuis Replit
- [ ] Import réussi sur bolt.new
- [ ] Variables d'environnement configurées
- [ ] `npm install` exécuté
- [ ] Base de données initialisée
- [ ] Vector Store reconfiguré
- [ ] Tests de conversation OK
- [ ] Synchronisation Git fonctionnelle

## Workflow Recommandé Post-Migration

1. **Développement principal** : Choisir Replit OU bolt.new
2. **Synchronisation régulière** : Git push/pull
3. **Mise à jour WhatsApp** : Sur plateforme principale
4. **Backup automatique** : GitHub garde tout l'historique

---
*Migration simplifiée via GitHub - Plus rapide et plus sûr*