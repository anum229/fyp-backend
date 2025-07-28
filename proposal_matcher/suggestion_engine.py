import json
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Load the same model used during vectorization
model = SentenceTransformer('all-MiniLM-L6-v2')

# Load vectorized proposals
with open("vectorized_proposals.json", "r", encoding="utf-8") as f:
    proposals = json.load(f)

def get_embedding(text):
    return model.encode(text, convert_to_numpy=True)

def get_top_project_suggestions(theme, tags, top_k=3):
    try:
        query_text = theme + " " + ", ".join(tags)
    except Exception as e:
        print("Error combining theme and tags:", e)
        return ["Invalid input format."]

    query_vec = get_embedding(query_text)

    scored = []

    for prop in proposals:
        if "embedding" not in prop or "title" not in prop:
            continue

        try:
            similarity = cosine_similarity(
                [query_vec], [prop["embedding"]]
            )[0][0]
            scored.append((prop["title"], similarity))
        except Exception as e:
            print(f"Skipping proposal due to error: {e}")
            continue

    if not scored:
        return ["No similar proposals available."]

    scored.sort(key=lambda x: x[1], reverse=True)
    return [title for title, _ in scored[:top_k]]
