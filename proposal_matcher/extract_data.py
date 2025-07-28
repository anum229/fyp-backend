import os
import requests
import pymongo
from PyPDF2 import PdfReader
import json

# MongoDB connection
client = pymongo.MongoClient("mongodb://127.0.0.1:27017")
db = client["smart_fyp_portal"]
collection = db["proposals"]  # Using collection name, not Mongoose model

# Output list for storing extracted data
approved_proposals = []

# Query proposals with fypStatus: "Approved"
for proposal in collection.find({"fypStatus": "Approved"}):
    title = proposal.get("projectTitle")
    pdf_url = proposal.get("pdfUrl")

    if not title or not pdf_url:
        continue

    try:
        # Download the PDF
        response = requests.get(pdf_url)
        pdf_path = "temp_proposal.pdf"
        with open(pdf_path, "wb") as f:
            f.write(response.content)

        # Extract text
        reader = PdfReader(pdf_path)
        full_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

        # Add to list
        approved_proposals.append({
            "title": title.strip(),
            "text": full_text.strip()
        })

        print(f"✅ Extracted: {title}")

    except Exception as e:
        print(f"❌ Error with {title}: {e}")

# Clean up temporary PDF
if os.path.exists("temp_proposal.pdf"):
    os.remove("temp_proposal.pdf")

# Save to JSON file
with open("approved_proposals.json", "w", encoding="utf-8") as f:
    json.dump(approved_proposals, f, ensure_ascii=False, indent=2)

print(f"\n✨ Done. {len(approved_proposals)} proposals saved to approved_proposals.json")