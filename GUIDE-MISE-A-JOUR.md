# 🔄 Guide de Mise à Jour ActiBot

## Processus Simple en 3 Étapes

### 1. Exporter WhatsApp
- Va dans ton groupe WhatsApp "Ai-Dialogue Actif"
- Exporte TOUTES les discussions (menu → Exporter le chat)
- Télécharge le fichier `.txt` complet

### 2. Remplacer le Fichier
- Va dans `attached_assets/` 
- Supprime l'ancien fichier WhatsApp
- Upload le nouveau fichier complet
- Renomme-le si nécessaire pour garder le même nom

### 3. Lancer la Mise à Jour dans Replit
```bash
node update-whatsapp-weekly.js
```

**⚠️ Important :** Lance cette commande directement dans le terminal Replit (en bas de l'écran)

## Ce qui se Passe Automatiquement

✅ Suppression complète ancien Vector Store  
✅ Génération 2320+ chunks temporels (fichier complet)  
✅ Upload vers OpenAI avec métadonnées  
✅ ActiBot à jour avec toutes les discussions  

## Fréquence Recommandée

- **Chaque semaine** : Si discussions très actives
- **Tous les 10 jours** : Rythme normal
- **À la demande** : Quand infos importantes partagées

## Durée Estimée

⏱️ **5-10 minutes** total (la plupart automatique)

## En Cas de Problème

Si la commande échoue :
1. Vérifier que le fichier WhatsApp est bien dans `attached_assets/`
2. Vérifier la connexion Internet Replit
3. Relancer la commande
4. Si ça persiste, me demander de l'aide

---
*Dernière mise à jour : Août 2025*