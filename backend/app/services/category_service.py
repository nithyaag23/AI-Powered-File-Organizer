import re
from pathlib import Path
from typing import Dict, Any, List

CATEGORY_EXTENSIONS = {
    "Documents": {
        ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".pages",
        ".csv", ".tsv", ".xls", ".xlsx", ".ppt", ".pptx", ".key",
        ".md", ".markdown", ".tex", ".json", ".xml", ".yaml", ".yml", ".log"
    },
    "Images": {
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp",
        ".tiff", ".tif", ".ico", ".raw", ".heic", ".psd", ".ai"
    },
    "Videos": {
        ".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm",
        ".m4v", ".3gp", ".mpeg", ".mpg"
    },
    "Audio": {
        ".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a", ".wma",
        ".aiff", ".alac", ".opus"
    },
    "Archives": {
        ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz",
        ".iso", ".dmg", ".pkg", ".deb"
    }
}

# Domain & Topic patterns checking both filename and extracted text
TOPIC_RULES = [
    # Academics
    (r"\bpsp\b|problem\s*solving", "Academics/Problem Solving", "Problem Solving", ["PSP", "Problem Solving", "Academics"]),
    (r"\bcn\b|computer\s*networks?|\btcp\b|osi\s*model|subnet|routing", "Academics/Computer Networks", "Computer Networks", ["Networks", "CN", "Academics"]),
    (r"machine\s*learning|\bml\b|neural|deep\s*learning|regression", "Academics/Machine Learning", "Machine Learning", ["ML", "AI", "Academics"]),
    (r"software\s*engineering|\buml\b|sdlc|use\s*case", "Academics/Software Engineering", "Software Engineering", ["SE", "UML", "Academics"]),
    (r"compiler|lexical|parsing", "Academics/Compiler Design", "Compiler Design", ["Compilers", "Academics"]),
    (r"digital\s*logic|flip\s*flop|karnaugh|boolean", "Academics/Digital Logic", "Digital Logic", ["Digital Logic", "Academics"]),
    (r"lab\s*manual|lab\s*record|practical\s*file", "Academics/Lab Work", "Lab Work", ["Lab", "Practical", "Academics"]),
    (r"project\s*report|synopsis|mini\s*project", "Academics/Project Reports", "Project Reports", ["Project", "Report", "Academics"]),
    (r"phy\d*|physics|viva|lab\s*viva|optics|spectrometer|galvanometer", "Academics/Physics", "Physics Coursework", ["Physics", "Lab Viva", "Academics"]),
    (r"dsa|algorithm|data\s*struct|array|tree|graph|leetcode|stack|queue", "Academics/Data Structures", "Data Structures & Algorithms", ["DSA", "Algorithms", "Computer Science"]),
    (r"dbms|sql|database|normalization|relational|mongodb", "Academics/Databases", "Database Management", ["DBMS", "SQL", "Databases"]),
    (r"operating\s*system|\bos\b|kernel|process\s*schedul|deadlock|semaphore", "Academics/Operating Systems", "Operating Systems", ["OS", "Kernel", "Academics"]),
    (r"math|calculus|algebra|differential|matrix|statistics|probability", "Academics/Mathematics", "Mathematics", ["Math", "Calculus", "Academics"]),
    (r"chemistry|chemical|organic|titration|reaction", "Academics/Chemistry", "Chemistry", ["Chemistry", "Academics"]),
    (r"cyber\s*security|ciphers?|information\s*security|cryptanalysis|\bcia\s*triad\b|penetration\s*testing|\brsa\b", "Academics/Cybersecurity", "Cybersecurity & Cryptography", ["Cybersecurity", "Security", "Academics"]),
    (r"computer\s*organization|computer\s*architecture|\bcoa\b|\bmips\b|instruction\s*set|\brisc\b|\bcisc\b", "Academics/Computer Architecture", "Computer Organization & Architecture", ["COA", "Architecture", "Academics"]),
    (r"automata|\btoc\b|turing\s*machine|context\s*free\s*grammar|\bcfg\b|\bpda\b|\bdfa\b|\bnfa\b", "Academics/Theory of Computation", "Theory of Computation", ["TOC", "Automata", "Academics"]),
    (r"cloud\s*computing|\baws\b|virtualization|\bazure\b|\bgcp\b|serverless|distributed\s*systems?", "Academics/Cloud Computing", "Cloud Computing & Distributed Systems", ["Cloud", "Distributed Systems", "Academics"]),
    (r"microprocessor|microcontroller|\b8086\b|\b8085\b|arm\s*cortex|embedded\s*systems?|\barduino\b|raspberry\s*pi", "Academics/Microprocessors", "Microprocessors & Embedded Systems", ["Microprocessors", "Embedded", "Academics"]),
    (r"internet\s*of\s*things|\biot\b|sensor\s*networks?|\brfid\b|\bactuators?\b", "Academics/Internet of Things", "Internet of Things", ["IoT", "Sensors", "Academics"]),
    (r"\bpyq\b|\bpyqs\b|question\s*paper|sample\s*paper|model\s*paper|mid\s*sem|end\s*sem", "Academics/Question Papers", "Question Papers & PYQs", ["PYQ", "Question Paper", "Academics"]),
    (r"hall\s*ticket|admit\s*card|student\s*id|bonafide|grade\s*card|marksheet|transcripts?", "Academics/Administrative", "Academic Credentials & Admin", ["Admin", "Admit Card", "Academics"]),
    # Hackathons & College Events
    (r"hackloop|hackathon|hacktoberfest|floss\s*fest|finite\s*loop|open\s*source\s*ai|problem\s*statement|scrum", "Events/Hackathons", "Hackathon & Tech Events", ["Hackathon", "Open Source", "Finite Loop"]),
    (r"club|brochure|invitation|fest|workshop|webinar|symposium", "Events/Clubs", "Club & Event Materials", ["Events", "Brochure", "Club"]),

    (r"exam|syllabus|assignment|coursework|lecture\s*notes|curriculum", "Academics/Coursework", "General Academics", ["Academics", "Coursework"]),

    # Career & Resumes
    (r"resume|curriculum\s*vitae|\bcv\b|cover\s*letter|internship|portfolio", "Career/Resumes", "Resume & Applications", ["Career", "Resume", "Job Search"]),
    (r"offer\s*letter|certificate|recommendation|\blor\b|appraisal", "Career/Certificates", "Certificates & Letters", ["Career", "Certificates"]),

    # Finance
    (r"invoice|receipt|bill|statement|tax|gst|salary|payslip|budget|expense", "Finance/Invoices", "Invoices & Receipts", ["Finance", "Invoice", "Payments"]),

    # Coding & Development
    (r"\bjava\b|\bc\+\+|\bc\s*programming|\bcpp\b", "Development/Languages", "Programming Languages", ["Java", "C", "Code"]),
    (r"\.py$|python|fastapi|django|flask|pandas|numpy", "Development/Python", "Python Code & Docs", ["Python", "Development", "Code"]),
    (r"\.tsx?$|\.jsx?$|react|javascript|typescript|frontend|tailwind|vite|nextjs", "Development/Web", "Web Development", ["React", "Web Dev", "Code"]),
    (r"github|git\b|readme|api\s*spec|backend|docker|kubernetes", "Development/Projects", "Project Repositories", ["Git", "Projects", "Code"]),

    # Media & Designs
    (r"removebg|preview|design|mockup|wireframe|banner|poster|flyer|logo", "Media/Designs", "Design & Graphic Assets", ["Design", "Graphics", "Assets"]),
    (r"screenshot|screen\s*shot|capture", "Media/Screenshots", "Screenshots", ["Screenshots", "Media"]),
]

def clean_filename(original_name: str) -> str:
    """Strip ugly artifacts from filenames like -removebg-preview, (1), duplicate extensions."""
    path = Path(original_name)
    stem = path.stem
    ext = path.suffix

    # Remove -removebg-preview, (1), copy, etc.
    stem = re.sub(r"[-_]removebg[-_]preview", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"\s*\(\d+\)", "", stem)
    stem = re.sub(r"[-_\s]+copy", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"[-_\s]+updated", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    # Capitalize title
    if stem:
        stem = " ".join([w.capitalize() for w in stem.split()])
    else:
        stem = path.stem

    return f"{stem}{ext}"

def detect_category(filename: str, mime_type: str = "") -> str:
    ext = Path(filename).suffix.lower()
    for cat, extensions in CATEGORY_EXTENSIONS.items():
        if ext in extensions:
            return cat
    
    if mime_type:
        if mime_type.startswith("image/"):
            return "Images"
        if mime_type.startswith("video/"):
            return "Videos"
        if mime_type.startswith("audio/"):
            return "Audio"
        if mime_type.startswith("text/") or "document" in mime_type or "pdf" in mime_type:
            return "Documents"
        if "zip" in mime_type or "tar" in mime_type or "compressed" in mime_type:
            return "Archives"

    return "Other"

def analyze_file_content(original_name: str, mime_type: str = "", extracted_text: str = "") -> Dict[str, Any]:
    """Analyze file name and body content to assign smart subfolder, topic, clean name, and tags."""
    main_cat = detect_category(original_name, mime_type)
    cleaned = clean_filename(original_name)
    content_to_check = f"{original_name} {extracted_text}".lower()

    subfolder = f"{main_cat}/General"
    topic = f"General {main_cat}"
    tags = [main_cat]
    confidence = 0.50

    for pattern, target_subfolder, target_topic, rule_tags in TOPIC_RULES:
        if re.search(pattern, content_to_check, re.IGNORECASE):
            subfolder = target_subfolder
            topic = target_topic
            tags = rule_tags
            confidence = 0.95
            break

    # If no rule matched, refine based on category
    if confidence == 0.50:
        if main_cat == "Images":
            subfolder = "Images/Photos & Graphics"
            topic = "Photo or Graphic"
            tags = ["Images", "Media"]
            confidence = 0.70
        elif main_cat == "Documents":
            subfolder = "Documents/Uncategorized"
            topic = "General Document"
            tags = ["Documents"]
            confidence = 0.60

    return {
        "category": main_cat,
        "subfolder": subfolder,
        "topic": topic,
        "clean_name": cleaned,
        "tags": tags,
        "confidence": confidence
    }

def extract_text_preview(file_path: Path, max_chars: int = 3500) -> str:
    """Extract readable text from document files for semantic indexing."""
    ext = file_path.suffix.lower()
    try:
        if ext in {".txt", ".md", ".csv", ".json", ".log", ".yaml", ".yml", ".tsv", ".xml", ".html", ".py", ".js", ".ts", ".css"}:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(max_chars)
                return content.strip()

        if ext == ".pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(str(file_path))
                text_parts = []
                for page in reader.pages[:8]:
                    extracted = page.extract_text()
                    if extracted:
                        text_parts.append(extracted)
                    if sum(len(p) for p in text_parts) >= max_chars:
                        break
                return "\n".join(text_parts)[:max_chars].strip()
            except Exception:
                pass

        if ext == ".docx":
            try:
                import docx
                doc = docx.Document(str(file_path))
                text_parts = [p.text for p in doc.paragraphs if p.text]
                return "\n".join(text_parts)[:max_chars].strip()
            except Exception:
                pass

    except Exception:
        pass

    return ""
