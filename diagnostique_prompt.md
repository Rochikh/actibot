# Diagnostic du problème d'accès à la base de connaissances dans ActiBot

## Architecture actuelle

ActiBot est une application de traitement de documents multilingue avec :
- Backend : Node.js avec Express
- Base de données : PostgreSQL avec Drizzle ORM
- Stockage vectoriel : pgvector pour les embeddings OpenAI
- Modèle LLM : GPT-4o
- Interface utilisateur : React avec shadcn/ui

### Structure de la base de données
```sql
documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  uploadedBy INTEGER REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT NOW()
)

document_chunks (
  id SERIAL PRIMARY KEY,
  documentId INTEGER REFERENCES documents(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  chunkIndex INTEGER NOT NULL,
  startOffset INTEGER NOT NULL,
  endOffset INTEGER NOT NULL,
  metadata JSONB
)
```

## Problème actuel

L'assistant ne semble pas utiliser la base de connaissances pour répondre aux questions des utilisateurs. Bien que les documents soient correctement uploadés et traités (chunking + embeddings), les réponses générées semblent ignorer le contexte fourni.

### Flux de traitement actuel

1. Upload du document :
   - Découpage en chunks de 1000 caractères
   - Génération d'embeddings via OpenAI
   - Stockage dans PostgreSQL avec pgvector

2. Recherche de similarité :
   - Seuil minimal de similarité : 0.1
   - Utilisation de pgvector pour la recherche cosinus
   - Requête SQL avec classement et partitionnement

3. Génération de réponse :
   - Modèle : gpt-4o
   - Température : 0.3
   - Contexte structuré fourni au modèle

### Code clé problématique

1. Recherche de similarité (openai.ts) :
```typescript
const relevantChunks = await db.execute(sql`
  WITH ranked_chunks AS (
    SELECT 
      dc.content,
      1 - (dc.embedding <-> ${queryEmbedding}::vector) as similarity,
      ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY dc.embedding <-> ${queryEmbedding}::vector) as chunk_rank
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
  )
  SELECT * FROM ranked_chunks
  WHERE similarity > ${MIN_SIMILARITY_THRESHOLD}
  ORDER BY similarity DESC, chunk_rank
  LIMIT 50
`);
```

2. Format du prompt système :
```typescript
const basePrompt = `En tant qu'assistant IA spécialisé dans l'analyse de documents, je vais vous aider à comprendre et extraire les informations pertinentes des documents.

Instructions spécifiques :
1. Utilisez UNIQUEMENT les informations fournies dans le contexte
2. Si l'information n'est pas dans le contexte, indiquez-le clairement
3. Citez les passages pertinents du contexte
4. Structurez votre réponse de manière claire
5. Si une information manque, demandez des précisions`;
```

## Tentatives de résolution

1. Ajustement des paramètres :
   - Réduction du seuil de similarité à 0.1
   - Augmentation du nombre de chunks retournés à 50
   - Réduction de la température à 0.3 pour plus de précision

2. Amélioration de la recherche :
   - Ajout du partitionnement par document
   - Tri par similarité et rang dans le document
   - Chevauchement entre les chunks

3. Renforcement du prompt :
   - Instructions plus strictes sur l'utilisation du contexte
   - Demande explicite de citations
   - Format de réponse structuré

## Observations

1. Les logs montrent que les embeddings sont générés correctement
2. La recherche de similarité retourne des résultats
3. Le contexte est bien formaté et envoyé à OpenAI
4. Malgré cela, les réponses semblent ignorer le contexte fourni

## Questions pour le diagnostic

1. Est-ce que le format du contexte fourni à OpenAI est optimal ?
2. Y a-t-il un problème avec la qualité des embeddings générés ?
3. Le seuil de similarité est-il encore trop élevé ?
4. Faut-il modifier la structure des chunks ou leur taille ?
5. Comment pouvons-nous vérifier que le contexte est effectivement utilisé par le modèle ?

## Informations techniques supplémentaires

- Version de Node.js : 20
- Version de PostgreSQL : 15
- Extension pgvector : activée
- Dimension des embeddings : 1536
- Taille moyenne des chunks : 1000 caractères
- Chevauchement entre chunks : ~200 caractères
- Limite de contexte OpenAI : 15000 tokens

Toute suggestion pour résoudre ce problème d'accès à la base de connaissances serait grandement appréciée.
