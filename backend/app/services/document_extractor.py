import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ExtractedSection(BaseModel):
    section_number: Optional[str] = None
    heading: str
    content: str
    category: str = "general"  # indications, side_effects, warnings, interactions, storage, general
    relevance_score: float = 0.0
    source_title: str = ""
    source_url: str = ""

SECTION_CATEGORY_PATTERNS = {
    "indications": [
        r"therapeutic\s+indications?",
        r"indications?\s+and\s+(usages?|clinical\s+use)",
        r"approved\s+uses?",
        r"what\s+(this\s+medicine|it)\s+is\s+used\s+for",
        r"why\s+is\s+this\s+medication\s+prescribed",
        r"\buses\b",
        r"\b4\.1\b"
    ],
    "side_effects": [
        r"undesirable\s+effects?",
        r"adverse\s+reactions?",
        r"side\s+effects?",
        r"possible\s+side\s+effects",
        r"risks\s+and\s+adverse\s+events",
        r"\b4\.8\b",
        r"\b4\.\s+possible\s+side\s+effects"
    ],
    "warnings": [
        r"special\s+warnings\s+and\s+precautions",
        r"warnings?\s+and\s+precautions",
        r"contraindications?",
        r"what\s+you\s+need\s+to\s+know\s+before\s+(you\s+take|taking)",
        r"boxed\s+warnings?",
        r"\b4\.3\b",
        r"\b4\.4\b",
        r"\b2\.\s+what\s+you\s+need\s+to\s+know"
    ],
    "interactions": [
        r"interaction\s+with\s+other\s+medicinal\s+products",
        r"drug\s+interactions?",
        r"other\s+medicines\s+and\s+",
        r"taking\s+with\s+other\s+medicines",
        r"\b4\.5\b"
    ],
    "storage": [
        r"special\s+precautions\s+for\s+storage",
        r"how\s+to\s+store",
        r"storage\s+and\s+handling",
        r"\b6\.4\b",
        r"\b5\.\s+how\s+to\s+store"
    ]
}

def categorize_heading(heading: str) -> str:
    h_lower = heading.lower().strip()
    for category, patterns in SECTION_CATEGORY_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, h_lower):
                return category
    return "general"

def extract_headings_and_sections(
    document_text: str,
    source_title: str = "",
    source_url: str = ""
) -> List[ExtractedSection]:
    """
    Parses document text, extracts section headings, preserves section numbers (e.g. 4.1, 4.2),
    and groups paragraphs with their associated headings.
    """
    sections: List[ExtractedSection] = []
    
    # Split text by Markdown headers or numbered section lines (e.g. "### 4.1 Therapeutic indications" or "4.1 Therapeutic indications")
    heading_regex = re.compile(
        r"(?:^|\n)(?:#{1,4}\s+)?((?:(?:[1-6]\.[0-9]{1,2}\.?)|(?:[1-6]\.?))\s+[^\n]+|[A-Z][A-Za-z0-9\s,\-–—]{3,60}:?)(?=\n|$)"
    )

    matches = list(heading_regex.finditer(document_text))
    
    if not matches:
        # Fallback: Treat whole document or large chunks as a section
        sections.append(ExtractedSection(
            heading=source_title or "General Information",
            content=document_text.strip(),
            category=categorize_heading(source_title),
            source_title=source_title,
            source_url=source_url
        ))
        return sections

    for i, match in enumerate(matches):
        raw_heading = match.group(1).strip().rstrip(":")
        start_pos = match.end()
        end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(document_text)
        content = document_text[start_pos:end_pos].strip()

        # Extract leading section number if present
        sec_num_match = re.match(r"^([1-6](?:\.[0-9]{1,2})?\.?)\s+(.*)", raw_heading)
        if sec_num_match:
            sec_num = sec_num_match.group(1).rstrip(".")
            clean_heading = sec_num_match.group(2).strip()
        else:
            sec_num = None
            clean_heading = raw_heading

        category = categorize_heading(raw_heading)

        if content:
            sections.append(ExtractedSection(
                section_number=sec_num,
                heading=clean_heading,
                content=content,
                category=category,
                source_title=source_title,
                source_url=source_url
            ))

    return sections

def rank_sections(
    sections: List[ExtractedSection],
    medicine_name: str,
    query_intent: str = "indications"
) -> List[ExtractedSection]:
    """
    Ranks extracted sections using:
    - Medicine name match
    - Query intent match
    - Section heading relevance (Therapeutic indications section ranks highest for uses queries)
    - Content length and richness
    """
    med_lower = medicine_name.lower().strip()
    
    for sec in sections:
        score = 0.0
        text_lower = (sec.heading + " " + sec.content).lower()

        # 1. Medicine name match in content or heading
        if med_lower in sec.heading.lower():
            score += 35.0
        elif med_lower in sec.content.lower():
            score += 20.0

        # 2. Query intent match vs section category
        if query_intent == "indications" or query_intent == "MEDICINE_INFORMATION":
            if sec.category == "indications":
                score += 50.0  # Therapeutic indications ranks highest for uses query!
            elif sec.category == "warnings":
                score += 15.0
            elif sec.category == "side_effects":
                score += 10.0
        elif query_intent == "side_effects" or query_intent == "SIDE_EFFECTS":
            if sec.category == "side_effects":
                score += 50.0
            elif sec.category == "warnings":
                score += 25.0
        elif query_intent == "interactions" or query_intent == "DRUG_INTERACTION":
            if sec.category == "interactions":
                score += 50.0

        # 3. Heading contains specific keywords
        if any(w in sec.heading.lower() for w in ["therapeutic indication", "approved uses", "prescribed for", "osteoarthritis"]):
            score += 25.0

        # 4. Content length penalty/bonus
        if len(sec.content) > 100:
            score += 10.0

        sec.relevance_score = score

    return sorted(sections, key=lambda s: s.relevance_score, reverse=True)
