from fastapi import FastAPI, UploadFile, Form
from sentence_transformers import SentenceTransformer, util
import fitz  # PyMuPDF
import json
import re

app = FastAPI()
model = SentenceTransformer('all-MiniLM-L6-v2')


@app.post("/review-proposal")
async def review_proposal(
    proposal_pdf: UploadFile,
    previous_fyps_pdf: UploadFile,
    project_title: str = Form(...),
    teacher_expertise_json: str = Form(...)
):
    proposal_text = extract_text(proposal_pdf.file)
    previous_titles = extract_lines(previous_fyps_pdf.file)
    text_lower = proposal_text.lower()

    print("\n📄 Extracted Project Title:", project_title)
    print("📄 Extracted Proposal Length:", len(proposal_text))

    # Step 1: Duplicate title check
    match_score = max([
        util.cos_sim(model.encode(project_title), model.encode(prev)).item()
        for prev in previous_titles
    ])
    print("🔁 Title match score:", match_score)

    if match_score > 0.8:
        return {
            "aiStatus": "Fail",
            "aiFeedback": "Poor",
            "aiFeedbackDescription": "Proposal title or functionality is too similar to a previous FYP.",
            "aiSuggestedSupervisor": None
        }

    # Step 2: Scoring with section-level analysis
    score = 0
    reasons_present = []
    reasons_missing = []

    def extract_section(text, section_name):
        pattern = re.compile(rf'{section_name}[\s\S]*?(?=\n[A-Z][a-zA-Z ]{{2,}}:|\Z)', re.IGNORECASE)
        match = pattern.findall(text)
        return match[0].strip() if match else ""

    # Hardware/Software check (by keyword)
    has_hardware = "hardware" in text_lower
    has_software = "software" in text_lower
    if has_hardware and has_software:
        score += 20
        reasons_present.append("Includes both hardware and software components.")
    elif not has_hardware and not has_software:
        reasons_missing.append("missing both hardware and software components")
    elif not has_hardware:
        reasons_missing.append("missing hardware component")
    elif not has_software:
        reasons_missing.append("missing software component")

    # Emerging technologies (specific list)
    tech_keywords = ["ai", "iot", "blockchain", "machine learning", "deep learning"]
    tech_found = [tech.upper() for tech in tech_keywords if tech in text_lower]
    if tech_found:
        score += 10
        reasons_present.append(f"Uses emerging technologies: {', '.join(tech_found)}.")
    else:
        reasons_missing.append("no use of emerging technologies like AI, IoT, or Blockchain")

    # Problem Statement
    problem_text = extract_section(proposal_text, "Problem Statement")
    if problem_text and len(problem_text.split()) > 20:
        score += 10
        reasons_present.append("Well-defined problem statement.")
    else:
        reasons_missing.append("problem statement section is missing or too brief")

    # Objectives
    objectives_text = extract_section(proposal_text, "Objectives")
    if objectives_text and len(objectives_text.split()) > 20:
        score += 10
        reasons_present.append("Objectives section is clearly defined.")
    else:
        reasons_missing.append("objectives section is missing or insufficient")

    # Design Approach
    design_text = extract_section(proposal_text, "Design")
    if design_text and len(design_text.split()) > 20:
        score += 10
        reasons_present.append("Includes design/architecture approach.")
    else:
        reasons_missing.append("design/architecture section is missing or too short")

    # Literature Review
    literature_text = extract_section(proposal_text, "Literature Review")
    if literature_text and len(literature_text.split()) > 30:
        score += 10
        reasons_present.append("Covers literature review in detail.")
    else:
        reasons_missing.append("literature review section missing or too brief")

    # Social/Sustainability
    if any(word in text_lower for word in ["social", "sustainability", "society", "green", "environment"]):
        score += 10
        reasons_present.append("Addresses social or environmental needs.")
    else:
        reasons_missing.append("no reference to social impact or sustainability")

    # Final decision
    status = "Pass" if score >= 60 else "Fail"
    aiFeedback = "Good" if status == "Pass" else "Poor"

    if status == "Pass":
        aiFeedbackDescription = "Positive feedback based on proposal content: " + " ".join(reasons_present)
    else:
        aiFeedbackDescription = (
            "Proposal failed due to the following issues: " +
            ", ".join(reasons_missing).capitalize() + "."
        )

    print("✅ AI Status:", status)
    print("✅ Feedback Label:", aiFeedback)
    print("📝 Description:", aiFeedbackDescription)

    # Step 3: Suggest supervisor
    teacher_expertise = json.loads(teacher_expertise_json)
    best_match = None
    best_score = 0
    for teacher_id, expertise_list in teacher_expertise.items():
        similarity = util.cos_sim(
            model.encode(proposal_text),
            model.encode(" ".join(expertise_list))
        ).item()
        if similarity > best_score:
            best_score = similarity
            best_match = teacher_id

    print("👤 Suggested Supervisor:", best_match)
    print("🔢 Total Score:", score)

    return {
        "aiStatus": status,
        "aiFeedback": aiFeedback,
        "aiFeedbackDescription": aiFeedbackDescription,
        "aiSuggestedSupervisor": best_match
    }


# --- PDF Helpers ---

def extract_text(file_obj):
    doc = fitz.open(stream=file_obj.read(), filetype="pdf")
    return "\n".join([page.get_text() for page in doc])


def extract_lines(file_obj):
    doc = fitz.open(stream=file_obj.read(), filetype="pdf")
    text = "\n".join([page.get_text() for page in doc])
    return [line.strip() for line in text.splitlines() if line.strip()]
