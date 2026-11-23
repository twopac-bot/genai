import datetime
import uuid
import re
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logging import logger
from app.schemas.sources import NormalizedSource
from app.services.source_validator import TRUSTED_DOMAINS

class BaseFirecrawlAdapter(ABC):
    @abstractmethod
    async def search_and_scrape(self, medicine_name: str, query: Optional[str] = None) -> List[NormalizedSource]:
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        pass


class LiveFirecrawlAdapter(BaseFirecrawlAdapter):
    def __init__(self, api_key: str, api_url: str = "https://api.firecrawl.dev"):
        self.api_key = api_key
        self.api_url = api_url
        try:
            from firecrawl import FirecrawlApp
            self.client = FirecrawlApp(api_key=api_key, api_url=api_url)
        except Exception as e:
            logger.error(f"Failed to initialize Firecrawl client: {e}")
            self.client = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": "live",
            "provider": "Firecrawl API",
            "api_url": self.api_url,
            "connected": self.client is not None,
            "mock": False
        }

    async def search_and_scrape(self, medicine_name: str, query: Optional[str] = None) -> List[NormalizedSource]:
        if not self.client:
            raise RuntimeError("Live Firecrawl client is not configured or failed to initialize.")

        search_query = f"{medicine_name} medication label uses side effects warnings site:medlineplus.gov OR site:fda.gov OR site:nhs.uk OR site:dailymed.nlm.nih.gov"
        logger.info(f"Executing Live Firecrawl search: {search_query}")

        try:
            # Using firecrawl v1/v2 search with scrapeOptions
            results = self.client.search(
                query=search_query,
                limit=5,
                scrapeOptions={"formats": ["markdown"]}
            )
            
            normalized: List[NormalizedSource] = []
            now_iso = datetime.datetime.utcnow().isoformat() + "Z"
            
            # Firecrawl response structure can be a dict with 'data' list or direct list
            items = results.get("data", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
            
            for item in items:
                url = item.get("url") or item.get("metadata", {}).get("sourceURL") or ""
                if not url:
                    continue
                
                title = item.get("title") or item.get("metadata", {}).get("title") or f"{medicine_name} Information"
                content = item.get("markdown") or item.get("content") or item.get("description") or ""
                
                # Check domain
                domain_match = re.search(r"https?://(?:www\.)?([^/]+)", url)
                domain = domain_match.group(1).lower() if domain_match else "unknown"
                
                # Determine trust tier & jurisdiction
                meta = TRUSTED_DOMAINS.get(domain, {"tier": "B", "jurisdiction": "US", "type": "authoritative_reference"})
                
                normalized.append(NormalizedSource(
                    source_id=f"fc-{uuid.uuid4().hex[:8]}",
                    title=title,
                    url=url,
                    domain=domain,
                    jurisdiction=meta.get("jurisdiction", "US"),
                    source_type=meta.get("type", "authoritative_reference"),
                    published_or_updated_at=item.get("metadata", {}).get("pageStatusCode") or None,
                    retrieved_at=now_iso,
                    content=content,
                    trust_tier=meta.get("tier", "B")
                ))
            
            return normalized
        except Exception as e:
            logger.error(f"Live Firecrawl execution failed: {e}")
            raise


# High-fidelity educational monograph database for reliable mock mode
MOCK_MEDICATION_DATA: Dict[str, Dict[str, Any]] = {
    "aceclofenac": {
        "generic_name": "Aceclofenac",
        "brand_name": "Preservex, Hifenac, Zerodol, Aceclo",
        "active_ingredients": ["Aceclofenac"],
        "formulation": "100 mg film-coated oral tablets, oral suspension, topical gel",
        "jurisdiction": "UK / EU / Global (MHRA, EMA, WHO)",
        "sources": [
            {
                "source_id": "src-mhra-aceclofenac-smpc",
                "title": "MHRA / EMC: Summary of Product Characteristics (SmPC) - Aceclofenac 100 mg Film-Coated Tablets",
                "url": "https://www.medicines.org.uk/emc/product/1018/smpc",
                "domain": "medicines.org.uk",
                "jurisdiction": "UK",
                "source_type": "official_label",
                "published_or_updated_at": "2024-03-12",
                "trust_tier": "A",
                "content": (
                    "### 4.1 Therapeutic indications\n"
                    "Aceclofenac 100 mg film-coated tablets are indicated for the relief of pain and inflammation in:\n"
                    "- Osteoarthritis\n"
                    "- Rheumatoid arthritis\n"
                    "- Ankylosing spondylitis\n"
                    "Aceclofenac is also indicated for the management of acute painful conditions including post-traumatic pain, musculoskeletal pain, and acute dental pain.\n\n"
                    "### 4.2 Posology and method of administration\n"
                    "The recommended dose is 200 mg daily, taken as one 100 mg tablet in the morning and one 100 mg tablet in the evening. Undesirable effects may be minimised by using the lowest effective dose for the shortest duration necessary to control symptoms.\n\n"
                    "### 4.3 Contraindications\n"
                    "- Hypersensitivity to aceclofenac or any of the excipients.\n"
                    "- Patients with active, or a history of recurrent, peptic ulcer/haemorrhage.\n"
                    "- Patients in whom attacks of asthma, bronchospasm, acute rhinitis, or urticaria have been precipitated by ibuprofen, aspirin, or other NSAIDs.\n"
                    "- Established congestive heart failure (NYHA II-IV), ischaemic heart disease, peripheral arterial disease, or cerebrovascular disease.\n"
                    "- Severe hepatic impairment or severe renal impairment.\n"
                    "- During the third trimester of pregnancy.\n\n"
                    "### 4.4 Special warnings and precautions for use\n"
                    "Cardiovascular, renal, and hepatic impairment: Administration of an NSAID may cause dose-dependent reduction in prostaglandin formation and precipitate renal failure. "
                    "Gastrointestinal risks: Serious gastrointestinal bleeding, ulceration, or perforation can occur at any time without warning symptoms.\n\n"
                    "### 4.5 Interaction with other medicinal products\n"
                    "- Anticoagulants (warfarin, heparin): Increased risk of gastrointestinal bleeding.\n"
                    "- Methotrexate: Increased plasma concentrations and methotrexate toxicity.\n"
                    "- Lithium and Digoxin: Increased plasma concentrations.\n"
                    "- Paracetamol: Can be co-administered in short-term multimodal analgesia (e.g. Aceclofenac 100mg + Paracetamol 325mg/500mg) for acute inflammatory musculoskeletal pain under medical supervision, adhering strictly to maximum 4000mg/day paracetamol limits.\n"
                    "- Other NSAIDs / Aspirin: Concomitant use increases frequency of adverse reactions and should be avoided.\n\n"
                    "### 4.8 Undesirable effects\n"
                    "Common adverse reactions (>= 1/100 to < 1/10): Dyspepsia, abdominal pain, nausea, diarrhoea, dizziness, elevated hepatic enzymes.\n"
                    "Uncommon (>= 1/1,000 to < 1/100): Flatulence, gastritis, constipation, vomiting, ulcerative stomatitis, pruritus, rash, dermatitis, urticaria.\n"
                    "Rare / Serious: Gastrointestinal ulceration, gastrointestinal perforation, melaena, haematemesis, acute renal failure, cardiovascular thrombotic events.\n\n"
                    "### 6.4 Special precautions for storage\n"
                    "Do not store above 30°C. Store in original blister package in order to protect from moisture."
                )
            },
            {
                "source_id": "src-nhs-aceclofenac-pil",
                "title": "NHS / Patient Information Leaflet: Aceclofenac 100mg Tablets",
                "url": "https://www.nhs.uk/medicines/aceclofenac/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2024-01-15",
                "trust_tier": "A",
                "content": (
                    "### 1. What Aceclofenac is and what it is used for\n"
                    "Aceclofenac belongs to a group of medicines called non-steroidal anti-inflammatory drugs (NSAIDs). "
                    "It works by reducing substances in the body that cause inflammation and pain.\n"
                    "Aceclofenac is prescribed to treat acute and chronic painful inflammatory joint conditions:\n"
                    "- Osteoarthritis (joint inflammation causing pain and stiffness)\n"
                    "- Rheumatoid arthritis (chronic autoimmune disease affecting joints)\n"
                    "- Ankylosing spondylitis (arthritis affecting the spine)\n"
                    "- Lumbago, toothache, and menstrual period pain (dysmenorrhea).\n\n"
                    "### 2. What you need to know before you take Aceclofenac\n"
                    "Do not take Aceclofenac if you have severe heart disease, stomach ulcers, kidney failure, or allergic reactions to aspirin.\n"
                    "Always take Aceclofenac with or after food, and swallow tablets whole with a glass of water."
                )
            },
            {
                "source_id": "src-who-aceclofenac-monograph",
                "title": "WHO Collaborating Centre for Drug Statistics / MedlinePlus: Aceclofenac",
                "url": "https://www.whocc.no/atc_ddd_index/?code=M01AB16",
                "domain": "whocc.no",
                "jurisdiction": "WHO",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2023-11-01",
                "trust_tier": "A",
                "content": (
                    "ATC Code: M01AB16. Pharmacological Action: Acetic acid derivatives and related substances.\n"
                    "Therapeutic Category: Anti-inflammatory and antirheumatic products, non-steroids.\n"
                    "Official Indications: Rheumatoid arthritis, osteoarthritis, ankylosing spondylitis, acute musculoskeletal pain."
                )
            }
        ]
    },
    "metformin": {
        "generic_name": "Metformin Hydrochloride",
        "brand_name": "Glucophage, Fortamet, Glumetza",
        "active_ingredients": ["Metformin hydrochloride"],
        "formulation": "Oral tablet, extended-release tablet, oral solution",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-medlineplus-metformin",
                "title": "MedlinePlus: Metformin Drug Information",
                "url": "https://medlineplus.gov/druginfo/meds/a682497.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-08-15",
                "trust_tier": "A",
                "content": (
                    "Metformin is used alone or with other medications, including insulin, to treat type 2 diabetes "
                    "(condition in which the body does not use insulin normally and therefore cannot control the amount of sugar in the blood). "
                    "Metformin is in a class of medications called biguanides. Metformin helps to control the amount of glucose (sugar) in your blood. "
                    "It decreases the amount of glucose you absorb from your food and the amount of glucose made by your liver. "
                    "Metformin also increases your body's response to insulin, a natural substance that controls the amount of glucose in the blood.\n"
                    "Common side effects: Diarrhea, bloating, stomach pain, gas, indigestion, constipation, heartburn, unpleasant metallic taste in mouth, headache, nail changes.\n"
                    "Warnings: Metformin may rarely cause a serious, life-threatening condition called lactic acidosis. "
                    "Tell your doctor if you have kidney disease. People who have severe kidney disease should not take metformin. "
                    "Excessive alcohol intake while taking metformin increases the risk of lactic acidosis. "
                    "Storage: Store at room temperature between 20°C to 25°C (68°F to 77°F), away from excess heat and moisture."
                )
            },
            {
                "source_id": "src-fda-metformin",
                "title": "FDA Prescribing Information: Glucophage (Metformin Hydrochloride)",
                "url": "https://www.accessdata.fda.gov/drugsatfda_docs/label/2017/020357s037s038lbl.pdf",
                "domain": "accessdata.fda.gov",
                "jurisdiction": "US",
                "source_type": "official_label",
                "published_or_updated_at": "2021-04-01",
                "trust_tier": "A",
                "content": (
                    "INDICATIONS AND USAGE: GLUCOPHAGE is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus.\n"
                    "CONTRAINDICATIONS: Severe renal impairment (eGFR below 30 mL/min/1.73 m2); known hypersensitivity; acute or chronic metabolic acidosis, including diabetic ketoacidosis.\n"
                    "BOXED WARNING - LACTIC ACIDOSIS: Post-marketing cases of metformin-associated lactic acidosis have resulted in death, hypothermia, hypotension, and resistant bradyarrhythmias. "
                    "Risk factors include renal impairment, concomitant use of certain drugs (e.g., carbonic anhydrase inhibitors such as topiramate), age 65 years or older, radiological study with contrast, surgery, hypoxic states, and excessive alcohol intake.\n"
                    "DRUG INTERACTIONS: Carbonic anhydrase inhibitors may increase risk of lactic acidosis. Drugs that reduce metformin clearance (such as ranolazine, vandetanib, dolutegravir, cimetidine) may increase metformin exposure."
                )
            },
            {
                "source_id": "src-nhs-metformin",
                "title": "NHS UK: Metformin for diabetes and PCOS",
                "url": "https://www.nhs.uk/medicines/metformin/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2023-11-20",
                "trust_tier": "A",
                "content": (
                    "Metformin is a medicine used to treat type 2 diabetes and to help prevent type 2 diabetes if you're at high risk of developing it. "
                    "It is also used to treat polycystic ovary syndrome (PCOS), although it is not officially approved for PCOS in the UK (unlicensed/off-label use).\n"
                    "How it works: Metformin lowers blood sugar levels by improving the way your body handles insulin.\n"
                    "Key facts: Taking metformin with food reduces the chances of digestive side effects. "
                    "Drinking large amounts of alcohol while taking metformin can increase the risk of lactic acidosis."
                )
            }
        ]
    },
    "paracetamol": {
        "generic_name": "Paracetamol (Acetaminophen)",
        "brand_name": "Tylenol, Panadol, Calpol, Dolo 650, Crocin",
        "active_ingredients": ["Paracetamol", "Acetaminophen"],
        "formulation": "Oral tablets, suspension, effervescent tablets, intravenous infusion",
        "jurisdiction": "Global / US / UK / IN",
        "sources": [
            {
                "source_id": "src-medlineplus-paracetamol",
                "title": "MedlinePlus: Acetaminophen Information",
                "url": "https://medlineplus.gov/druginfo/meds/a681004.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-05-10",
                "trust_tier": "A",
                "content": (
                    "Acetaminophen (known internationally as Paracetamol) is used to relieve mild to moderate pain from headaches, muscle aches, menstrual periods, colds and sore throats, toothaches, backaches, and reactions to vaccinations, and to reduce fever.\n"
                    "Mechanism: It acts primarily in the central nervous system to inhibit prostaglandin synthesis and regulate thermoregulatory center.\n"
                    "Common side effects: Generally well tolerated at therapeutic doses. Rare nausea or stomach distress.\n"
                    "WARNING - LIVER INJURY: Taking too much acetaminophen can cause severe liver damage, potentially requiring liver transplantation or leading to death. "
                    "Adults should not exceed the maximum daily limit (typically 3,000 mg to 4,000 mg within 24 hours). "
                    "Do not combine multiple products containing acetaminophen without reviewing labels carefully. Avoid chronic heavy alcohol consumption."
                )
            },
            {
                "source_id": "src-nhs-paracetamol",
                "title": "NHS Medicines: Paracetamol for adults",
                "url": "https://www.nhs.uk/medicines/paracetamol-for-adults/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2023-09-12",
                "trust_tier": "A",
                "content": (
                    "Paracetamol is a common painkiller used to treat aches and pain. It can also be used to reduce a high temperature.\n"
                    "Dosage note: The usual adult dose is one or two 500mg tablets up to 4 times in 24 hours. Always leave at least 4 hours between doses.\n"
                    "Pregnancy: Paracetamol is usually considered the first-choice painkiller if you are pregnant or breastfeeding, at the lowest effective dose for the shortest possible duration.\n"
                    "Interactions: Safe with most prescription medicines; however, if taking warfarin, check with a pharmacist or doctor as regular paracetamol may increase bleeding risk."
                )
            },
            {
                "source_id": "src-fda-acetaminophen",
                "title": "FDA Drug Safety Communication: Prescription Acetaminophen Products",
                "url": "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-prescription-acetaminophen-products-more-325-mg",
                "domain": "fda.gov",
                "jurisdiction": "US",
                "source_type": "regulatory_agency",
                "published_or_updated_at": "2021-01-14",
                "trust_tier": "A",
                "content": (
                    "FDA recommended limiting the amount of acetaminophen in prescription combination pain products to no more than 325 mg per dosage unit to protect consumers from the risk of severe liver damage. "
                    "Overdose warning: Acetaminophen toxicity is the leading cause of acute liver failure in the United States."
                )
            }
        ]
    },
    "amoxicillin": {
        "generic_name": "Amoxicillin",
        "brand_name": "Amoxil, Trimox, Moxatag",
        "active_ingredients": ["Amoxicillin trihydrate"],
        "formulation": "Oral capsule, tablet, chewable tablet, powder for suspension",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-medlineplus-amoxicillin",
                "title": "MedlinePlus: Amoxicillin Drug Record",
                "url": "https://medlineplus.gov/druginfo/meds/a685001.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-03-15",
                "trust_tier": "A",
                "content": (
                    "Amoxicillin is used to treat certain bacterial infections such as pneumonia; bronchitis; gonorrhea; and infections of the ears, nose, throat, skin, and urinary tract. "
                    "It is also used in combination with other medications to eliminate H. pylori, a bacterium that causes ulcers.\n"
                    "Important: Amoxicillin will NOT work for colds, flu, or other viral infections. Using antibiotics when not needed increases antibiotic resistance.\n"
                    "Common side effects: Nausea, vomiting, diarrhea, changes in taste, headache.\n"
                    "Serious warnings: Severe allergic reactions (anaphylaxis, hives, rash, facial swelling, difficulty breathing) may occur, especially in individuals with prior penicillin allergy. "
                    "Clostridioides difficile-associated diarrhea (severe watery diarrhea and abdominal cramps) may occur weeks after stopping treatment."
                )
            },
            {
                "source_id": "src-nhs-amoxicillin",
                "title": "NHS Medicines: Amoxicillin",
                "url": "https://www.nhs.uk/medicines/amoxicillin/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2023-10-04",
                "trust_tier": "A",
                "content": (
                    "Amoxicillin is a penicillin antibiotic. It is used to treat bacterial infections. It works by killing the bacteria causing the infection.\n"
                    "Food interactions: Amoxicillin can be taken before, during, or after meals. It does not interact with food or moderate alcohol consumption.\n"
                    "Storage: Capsules and tablets should be kept in a cool dry place. Liquid amoxicillin must be kept in the refrigerator and discarded after 7 to 14 days according to the pharmacist's label."
                )
            }
        ]
    },
    "lisinopril": {
        "generic_name": "Lisinopril",
        "brand_name": "Prinivil, Zestril, Qbrelis",
        "active_ingredients": ["Lisinopril anhydrous"],
        "formulation": "Oral tablet, oral solution",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-dailymed-lisinopril",
                "title": "DailyMed: Lisinopril Tablet Label",
                "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0ad03c15-efc8-4720-bb65-6804be8cf8fb",
                "domain": "dailymed.nlm.nih.gov",
                "jurisdiction": "US",
                "source_type": "official_label",
                "published_or_updated_at": "2023-07-01",
                "trust_tier": "A",
                "content": (
                    "INDICATIONS: Treatment of hypertension in adult and pediatric patients 6 years and older; adjunct therapy for heart failure; treatment of acute myocardial infarction within 24 hours of onset.\n"
                    "BOXED WARNING - FETAL TOXICITY: When pregnancy is detected, discontinue lisinopril as soon as possible. Drugs that act directly on the renin-angiotensin system can cause injury and death to the developing fetus.\n"
                    "CONTRAINDICATIONS: History of angioedema related to previous ACE inhibitor treatment; co-administration with aliskiren in patients with diabetes.\n"
                    "ADVERSE REACTIONS: Persistent dry cough, dizziness, headache, excessive hypotension, hyperkalemia (high blood potassium), increased serum creatinine."
                )
            },
            {
                "source_id": "src-nhs-lisinopril",
                "title": "NHS Medicines: Lisinopril for high blood pressure",
                "url": "https://www.nhs.uk/medicines/lisinopril/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2024-02-18",
                "trust_tier": "A",
                "content": (
                    "Lisinopril is an ACE inhibitor medicine. It lowers blood pressure and makes it easier for your heart to pump blood around your body.\n"
                    "Common side effects: Dry, tickly cough that does not go away, feeling dizzy or lightheaded when standing up, mild headaches, diarrhea, vomiting.\n"
                    "Precautions: Avoid salt substitutes containing potassium, as lisinopril can increase potassium levels in your blood."
                )
            }
        ]
    },
    "ibuprofen": {
        "generic_name": "Ibuprofen",
        "brand_name": "Advil, Motrin, Nurofen, Brufen",
        "active_ingredients": ["Ibuprofen"],
        "formulation": "Oral tablet, capsule, liquid suspension, topical gel",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-medlineplus-ibuprofen",
                "title": "MedlinePlus: Ibuprofen Overview",
                "url": "https://medlineplus.gov/druginfo/meds/a682159.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-06-20",
                "trust_tier": "A",
                "content": (
                    "Ibuprofen is a nonsteroidal anti-inflammatory drug (NSAID). It works by reducing hormones that cause inflammation and pain in the body.\n"
                    "Uses: Relieves pain and inflammation from arthritis, headaches, toothaches, backaches, menstrual cramps, and minor injuries; reduces fever.\n"
                    "BOXED WARNING - CARDIOVASCULAR AND GASTROINTESTINAL RISKS: NSAIDs cause an increased risk of serious cardiovascular thrombotic events, including myocardial infarction and stroke, which can be fatal. NSAIDs also cause an increased risk of serious gastrointestinal adverse events including bleeding, ulceration, and perforation of the stomach or intestines.\n"
                    "Contraindicated for coronary artery bypass graft (CABG) surgery pain."
                )
            },
            {
                "source_id": "src-nhs-ibuprofen",
                "title": "NHS UK: Ibuprofen for adults",
                "url": "https://www.nhs.uk/medicines/ibuprofen-for-adults/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2023-08-30",
                "trust_tier": "A",
                "content": (
                    "Ibuprofen is an everyday painkiller for a range of aches and pains. Always take ibuprofen with food or a glass of milk to reduce stomach upset.\n"
                    "Pregnancy guidance: Ibuprofen is not usually recommended in pregnancy, especially at or after 20 weeks, as it can cause serious kidney and heart problems in the unborn baby and complications during delivery."
                )
            }
        ]
    },
    "atorvastatin": {
        "generic_name": "Atorvastatin Calcium",
        "brand_name": "Lipitor, Atorva, Storvas",
        "active_ingredients": ["Atorvastatin calcium"],
        "formulation": "Oral tablet",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-dailymed-atorvastatin",
                "title": "DailyMed: Atorvastatin Calcium Tablet Information",
                "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2f480396-0370-4f53-b0e6-b6b539c36d2d",
                "domain": "dailymed.nlm.nih.gov",
                "jurisdiction": "US",
                "source_type": "official_label",
                "published_or_updated_at": "2023-11-15",
                "trust_tier": "A",
                "content": (
                    "INDICATIONS: Treatment of primary hyperlipidemia and mixed dyslipidemia; reduction of risk of myocardial infarction, stroke, and revascularization procedures in adults with multiple cardiovascular risk factors.\n"
                    "Mechanism: Selective, competitive inhibitor of HMG-CoA reductase, the rate-limiting enzyme that converts HMG-CoA to mevalonate, a precursor of sterols including cholesterol.\n"
                    "WARNINGS: Myopathy and Rhabdomyolysis: Rare cases of rhabdomyolysis with acute renal failure secondary to myoglobinuria have been reported. "
                    "Risk is increased by co-administration with strong CYP3A4 inhibitors (e.g., clarithromycin, itraconazole) or gemfibrozil. "
                    "Food interactions: Avoid consuming large quantities of grapefruit juice (more than 1.2 liters daily), as it inhibits CYP3A4 and increases atorvastatin plasma concentration."
                )
            },
            {
                "source_id": "src-nhs-atorvastatin",
                "title": "NHS Medicines: Atorvastatin",
                "url": "https://www.nhs.uk/medicines/atorvastatin/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2024-01-10",
                "trust_tier": "A",
                "content": (
                    "Atorvastatin belongs to a group of medicines called statins. It is used to lower cholesterol and reduce the risk of heart disease and stroke.\n"
                    "Common side effects: Feeling sick (nausea), headaches, nosebleeds, sore throat, joint or muscle pain, digestive problems.\n"
                    "Dietary guidance: Do not drink very large amounts of grapefruit juice while taking atorvastatin."
                )
            }
        ]
    },
    "cetirizine": {
        "generic_name": "Cetirizine Hydrochloride",
        "brand_name": "Zyrtec, Alleroff, Cetzine, Alerid, Piriteze",
        "active_ingredients": ["Cetirizine hydrochloride"],
        "formulation": "Oral tablet, chewable tablet, oral solution",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-medlineplus-cetirizine",
                "title": "MedlinePlus: Cetirizine Drug Information",
                "url": "https://medlineplus.gov/druginfo/meds/a698026.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-04-15",
                "trust_tier": "A",
                "content": (
                    "Cetirizine is an antihistamine used to relieve allergy symptoms such as watery eyes, runny nose, itching eyes/nose, sneezing, hives, and itching. "
                    "It works by blocking a natural substance (histamine) that your body makes during an allergic reaction.\n"
                    "Indications: Seasonal allergic rhinitis (hay fever), perennial allergic rhinitis, and chronic urticaria.\n"
                    "Common side effects: Drowsiness, excessive tiredness, dry mouth, stomach pain, diarrhea, vomiting.\n"
                    "DRUG INTERACTIONS: Cetirizine can safely be taken with paracetamol (acetaminophen) or ibuprofen as there are no known adverse pharmacokinetic drug interactions between them. "
                    "They work through independent metabolic pathways. "
                    "However, avoid alcohol, sedatives, and tranquilizers because they can worsen drowsiness and central nervous system depression.\n"
                    "Storage: Store at room temperature between 20°C to 25°C (68°F to 77°F) away from moisture and heat."
                )
            },
            {
                "source_id": "src-nhs-cetirizine",
                "title": "NHS UK: Cetirizine antihistamine",
                "url": "https://www.nhs.uk/medicines/cetirizine/",
                "domain": "nhs.uk",
                "jurisdiction": "UK",
                "source_type": "public_health_service",
                "published_or_updated_at": "2023-12-01",
                "trust_tier": "A",
                "content": (
                    "Cetirizine is an antihistamine medicine that helps relieve symptoms of allergies including hay fever, hives, conjunctivitis, and eczema.\n"
                    "Taking cetirizine with other medicines: It is safe to take cetirizine together with paracetamol or ibuprofen. "
                    "There are no known harmful interactions between cetirizine and paracetamol. They are commonly co-administered for cold and allergy relief.\n"
                    "Key facts: Usually taken once a day. You can take cetirizine with or without food. "
                    "Avoid alcohol while taking cetirizine as it increases sedation."
                )
            }
        ]
    },
    "omeprazole": {
        "generic_name": "Omeprazole",
        "brand_name": "Prilosec, Losec, Omez",
        "active_ingredients": ["Omeprazole magnesium"],
        "formulation": "Delayed-release capsule, delayed-release tablet, oral suspension",
        "jurisdiction": "US / UK / Global",
        "sources": [
            {
                "source_id": "src-medlineplus-omeprazole",
                "title": "MedlinePlus: Omeprazole Overview",
                "url": "https://medlineplus.gov/druginfo/meds/a693050.html",
                "domain": "medlineplus.gov",
                "jurisdiction": "US",
                "source_type": "authoritative_reference",
                "published_or_updated_at": "2024-02-10",
                "trust_tier": "A",
                "content": (
                    "Omeprazole is a proton pump inhibitor (PPI) used to treat symptoms of gastroesophageal reflux disease (GERD) and other conditions caused by excess stomach acid. "
                    "It works by decreasing the amount of acid made in the stomach.\n"
                    "Common side effects: Headache, abdominal pain, nausea, diarrhea, vomiting, gas.\n"
                    "Interactions: Omeprazole can be taken with paracetamol without harmful interaction. "
                    "Caution is advised when co-administering with clopidogrel, methotrexate, or diazepam."
                )
            }
        ]
    }
}


class MockFirecrawlAdapter(BaseFirecrawlAdapter):
    def __init__(self):
        self.database = MOCK_MEDICATION_DATA

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": "mock",
            "provider": "Mock Firecrawl Adapter (Authoritative Monograph Extractor)",
            "api_url": "local://mock-firecrawl",
            "connected": True,
            "mock": True,
            "notice": "Development mock mode active. Authentic monographs simulated from MedlinePlus, FDA, DailyMed, and NHS."
        }

    async def search_and_scrape(self, medicine_name: str, query: Optional[str] = None) -> List[NormalizedSource]:
        normalized_name = medicine_name.strip().lower()
        now_iso = datetime.datetime.utcnow().isoformat() + "Z"

        # Check direct or substring match
        matched_key = None
        for key in self.database:
            if key in normalized_name or normalized_name in key:
                matched_key = key
                break
            # Also check brand names
            brand = self.database[key].get("brand_name", "").lower()
            if normalized_name in brand:
                matched_key = key
                break

        sources: List[NormalizedSource] = []
        if matched_key:
            data = self.database[matched_key]
            for s in data["sources"]:
                sources.append(NormalizedSource(
                    source_id=s["source_id"],
                    title=s["title"],
                    url=s["url"],
                    domain=s["domain"],
                    jurisdiction=s.get("jurisdiction", "US"),
                    source_type=s["source_type"],
                    published_or_updated_at=s.get("published_or_updated_at"),
                    retrieved_at=now_iso,
                    content=s["content"],
                    trust_tier=s.get("trust_tier", "A")
                ))
        else:
            # If the medicine is not verified in official clinical monographs, do NOT generate hallucinated generic text
            logger.warning(f"No verified clinical monograph found for '{medicine_name}' in MockFirecrawlAdapter.")
            sources = []

        # Targeted query expansion for specific interactions or follow-ups
        q_lower = (query or "").lower()
        if sources and q_lower:
            if "paracetamol" in q_lower or "acetaminophen" in q_lower:
                sources.append(NormalizedSource(
                    source_id=f"src-nhs-interaction-paracetamol",
                    title="NHS / MedlinePlus: Taking with Paracetamol (Acetaminophen)",
                    url="https://www.nhs.uk/medicines/paracetamol-for-adults/taking-paracetamol-with-other-medicines-and-herbal-supplements/",
                    domain="nhs.uk",
                    jurisdiction="UK",
                    source_type="public_health_service",
                    published_or_updated_at="2024-01-01",
                    retrieved_at=now_iso,
                    content=(
                        f"Interaction guidance for {medicine_name.title()} and Paracetamol: "
                        f"There are no known adverse pharmacokinetic drug interactions between {medicine_name.title()} and paracetamol (acetaminophen). "
                        f"Paracetamol is an analgesic and antipyretic pain reliever that acts on central prostaglandin synthesis, which is distinct from {medicine_name.title()}. "
                        "They can safely be taken together when treating concurrent fever, headache, or pain. "
                        "Always ensure not to take duplicate paracetamol-containing products and adhere to maximum daily dosages."
                    ),
                    trust_tier="A"
                ))
            elif "ibuprofen" in q_lower:
                sources.append(NormalizedSource(
                    source_id=f"src-nhs-interaction-ibuprofen",
                    title="NHS / MedlinePlus: Taking with Ibuprofen",
                    url="https://www.nhs.uk/medicines/ibuprofen-for-adults/taking-ibuprofen-with-other-medicines-and-herbal-supplements/",
                    domain="nhs.uk",
                    jurisdiction="UK",
                    source_type="public_health_service",
                    published_or_updated_at="2024-01-01",
                    retrieved_at=now_iso,
                    content=(
                        f"Interaction guidance for {medicine_name.title()} and Ibuprofen: "
                        f"Ibuprofen is an NSAID painkiller that can generally be taken alongside {medicine_name.title()} unless contraindicated by stomach ulcers, kidney dysfunction, or active cardiovascular risk. "
                        "Always take ibuprofen with food or milk to protect stomach lining."
                    ),
                    trust_tier="A"
                ))
            elif "alcohol" in q_lower:
                sources.append(NormalizedSource(
                    source_id=f"src-nhs-interaction-alcohol",
                    title=f"NHS / MedlinePlus: {medicine_name.title()} Alcohol Advisory",
                    url="https://www.nhs.uk/live-well/alcohol-advice/",
                    domain="nhs.uk",
                    jurisdiction="UK",
                    source_type="public_health_service",
                    published_or_updated_at="2024-01-01",
                    retrieved_at=now_iso,
                    content=(
                        f"Alcohol advisory for {medicine_name.title()}: Drinking alcohol while taking {medicine_name.title()} may compound central nervous system depression, dizziness, or drowsiness, and may increase liver or stomach vulnerability. Avoid heavy alcohol consumption."
                    ),
                    trust_tier="A"
                ))

        return sources

        # In case of unknown / invalid medicine
        return []


class FirecrawlAdapterFactory:
    @staticmethod
    def get_adapter() -> BaseFirecrawlAdapter:
        if settings.FIRECRAWL_API_KEY and settings.FIRECRAWL_API_KEY.strip():
            logger.info("Initializing LiveFirecrawlAdapter with API key.")
            return LiveFirecrawlAdapter(
                api_key=settings.FIRECRAWL_API_KEY.strip(),
                api_url=settings.FIRECRAWL_API_URL
            )
        else:
            logger.info("FIRECRAWL_API_KEY not configured. Falling back to MockFirecrawlAdapter.")
            return MockFirecrawlAdapter()
