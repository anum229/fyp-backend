import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Load vectorized proposals
with open('vectorized_proposals.json', 'r', encoding='utf-8') as f:
    proposals = json.load(f)

# Load embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# 🔽 Step 1: Get input from user
theme = input("Enter your project theme: ").strip()
tags = input("Enter tags (comma-separated): ").strip()

# 🔽 Step 2: Prepare user query
combined_input = theme + "\n" + ", ".join([t.strip() for t in tags.split(",") if t.strip()])

# 🔽 Step 3: Vectorize user input
user_embedding = model.encode(combined_input, convert_to_numpy=True)

# 🔽 Step 4: Compare with existing embeddings
results = []

for proposal in proposals:
    proposal_title = proposal['title']
    proposal_embedding = np.array(proposal['embedding'])

    similarity = cosine_similarity(
        [user_embedding], [proposal_embedding]
    )[0][0]

    results.append((proposal_title, round(similarity, 4)))

# 🔽 Step 5: Sort and show top 3
top_matches = sorted(results, key=lambda x: x[1], reverse=True)[:3]

print("\n🔍 Top 3 most similar proposals:")
for i, (title, score) in enumerate(top_matches, 1):
    print(f"{i}. {title} — Similarity: {score}")