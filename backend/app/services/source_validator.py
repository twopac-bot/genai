import re
import hashlib
from typing import List, Dict, Tuple, Optional, Any
from app.schemas.sources import NormalizedSource
from app.schemas.medication import SourceConflict, DifferingView

# Trusted domains and their classifications
TRUSTED_DOMAINS = {
    # Tier A: Official Regulators & Label Databases
    "fda.gov": {"tier": "A", "jurisdiction": "US", "type": "regulatory_agency"},
    "dailymed.nlm.nih.gov": {"tier": "A", "jurisdiction": "US", "type": "official_label"},
    "medlineplus.gov": {"tier": "A", "jurisdiction": "US", "type": "authoritative_reference"},
    "accessdata.fda.gov": {"tier": "A", "jurisdiction": "US", "type": "official_label"},
    "nhs.uk": {"tier": "A", "jurisdiction": "UK", "type": "public_health_service"},
    "medicines.org.uk": {"tier": "A", "jurisdiction": "UK", "type": "official_label"},
    "who.int": {"tier": "A", "jurisdiction": "WHO", "type": "public_health_service"},
    "cdsco.gov.in": {"tier": "A", "jurisdiction": "IN", "type": "regulatory_agency"},
    "ema.europa.eu": {"tier": "A", "jurisdiction": "EU", "type": "regulatory_agency"},
    "tga.gov.au": {"tier": "A", "jurisdiction": "AU", "type": "regulatory_agency"},

    # Tier B: Academic Medical Centers, Reputable Drug References
    "drugs.com": {"tier": "B", "jurisdiction": "US", "type": "authoritative_reference"},
    "mayoclinic.org": {"tier": "B", "jurisdiction": "US", "type": "patient_education"},
    "clevelandclinic.org": {"tier": "B", "jurisdiction": "US", "type": "patient_education"},
    "hopkinsmedicine.org": {"tier": "B", "jurisdiction": "US", "type": "patient_education"},
    "webmd.com": {"tier": "B", "jurisdiction": "US", "type": "patient_education"},

    # Tier C: Other standard health reference pages
    "healthline.com": {"tier": "C", "jurisdiction": "US", "type": "patient_education"},
    "medicalnewstoday.com": {"tier": "C", "jurisdiction": "US", "type": "patient_education"}
}

class SourceValidator:
    def __init__(self, allowlist: Optional[Dict[str, dict]] = None):
        self.allowlist = allowlist or TRUSTED_DOMAINS

    def extract_domain(self, url: str) -> str:
        domain = re.sub(r"^https?://(www\.)?", "", url.lower())
        domain = domain.split("/")[0].split(":")[0]
        return domain

    def is_allowed_domain(self, domain: str) -> bool:
        domain = domain.lower()
        for allowed in self.allowlist.keys():
            if domain == allowed or domain.endswith("." + allowed):
                return True
        return False

    def get_domain_metadata(self, domain: str) -> Dict[str, str]:
        domain = domain.lower()
        for allowed, meta in self.allowlist.items():
            if domain == allowed or domain.endswith("." + allowed):
                return meta
        return {"tier": "C", "jurisdiction": "Unknown", "type": "other"}

    def compute_content_hash(self, content: str) -> str:
        normalized = re.sub(r"\s+", " ", content.strip().lower())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def deduplicate_and_rank(self, sources: List[NormalizedSource]) -> List[NormalizedSource]:
        """
        Deduplicates sources by normalized URL and content hash, and ranks:
        Tier A (Regulators) > Tier B (Clinical) > Tier C (General).
        """
        seen_urls = set()
        seen_hashes = set()
        unique_sources = []

        for s in sources:
            norm_url = s.url.strip().lower().rstrip("/")
            content_hash = s.content_hash or self.compute_content_hash(s.content)
            s.content_hash = content_hash

            if norm_url in seen_urls:
                continue
            if content_hash in seen_hashes:
                continue

            seen_urls.add(norm_url)
            seen_hashes.add(content_hash)
            unique_sources.append(s)

        # Rank sources: Tier A first (rank 1), Tier B (rank 2), Tier C (rank 3)
        tier_order = {"A": 1, "B": 2, "C": 3}
        ranked = sorted(
            unique_sources,
            key=lambda item: (tier_order.get(item.trust_tier, 4), item.published_or_updated_at is None)
        )
        return ranked

    def detect_conflicts(self, sources: List[NormalizedSource]) -> List[SourceConflict]:
        """
        Scans normalized sources for conflicting statements (e.g. pregnancy warnings,
        food interaction differences between US FDA label and UK NHS guidance).
        """
        conflicts = []

        # Example check: Food interactions (e.g., Grapefruit)
        grapefruit_pro = []
        grapefruit_con = []
        # Example check: Pregnancy category / guidance
        pregnancy_safe = []
        pregnancy_caution = []
        # Example check: Over-the-counter vs Prescription status
        otc_claims = []
        prescription_only = []

        for s in sources:
            text = s.content.lower()

            # Grapefruit check
            if "avoid grapefruit" in text or "grapefruit juice may increase" in text or "grapefruit interaction" in text:
                grapefruit_pro.append((s, "Warns against consuming grapefruit or grapefruit juice due to altered drug metabolism."))
            elif "grapefruit does not affect" in text or "can be taken with any fruit juice" in text:
                grapefruit_con.append((s, "States no significant interaction with grapefruit."))

            # Pregnancy check
            if "do not use during pregnancy" in text or "contraindicated in pregnancy" in text or "boxed warning for pregnancy" in text:
                pregnancy_caution.append((s, "Advises against use during pregnancy or cites fetal risk."))
            elif "generally safe in pregnancy" in text or "preferred choice in pregnancy" in text or "considered safe when indicated" in text:
                pregnancy_safe.append((s, "Notes this medication is commonly used or considered lower-risk during pregnancy when prescribed."))

            # OTC vs Prescription
            if "prescription only" in text or "rx only" in text:
                prescription_only.append((s, "Classified as prescription-only (Rx)."))
            elif "over-the-counter" in text or "available otc" in text or "without a prescription" in text:
                otc_claims.append((s, "Available over-the-counter (OTC) in specific formulations or jurisdictions."))

        if grapefruit_pro and grapefruit_con:
            conflicts.append(SourceConflict(
                topic="Food Interaction (Grapefruit)",
                description="Sources provide differing guidance regarding dietary interactions with grapefruit.",
                differing_views=[
                    DifferingView(source_id=s.source_id, source_title=s.title, statement=stmt)
                    for s, stmt in grapefruit_pro + grapefruit_con
                ]
            ))

        if pregnancy_caution and pregnancy_safe:
            conflicts.append(SourceConflict(
                topic="Use During Pregnancy",
                description="Regulatory guidance differs by trimester, indication, or national authority.",
                differing_views=[
                    DifferingView(source_id=s.source_id, source_title=s.title, statement=stmt)
                    for s, stmt in pregnancy_caution + pregnancy_safe
                ]
            ))

        if prescription_only and otc_claims:
            conflicts.append(SourceConflict(
                topic="Regulatory Availability (OTC vs Prescription)",
                description="Regulatory status varies by jurisdiction or dosage strength.",
                differing_views=[
                    DifferingView(source_id=s.source_id, source_title=s.title, statement=stmt)
                    for s, stmt in prescription_only + otc_claims
                ]
            ))

        return conflicts

source_validator = SourceValidator()
