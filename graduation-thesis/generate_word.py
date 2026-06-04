"""
Generate a Word document from all thesis markdown files.
Preserves formatting: headings, bold, italic, code blocks, tables, lists.
Replaces ASCII diagrams with rendered Mermaid PNG images.
"""

import re
import os
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# Thesis files in order
THESIS_FILES = [
    "chapter-01-introduction.md",
    "chapter-02-literature-review.md",
    "chapter-03-requirements-analysis.md",
    "chapter-04-system-design-part1.md",
    "chapter-04-system-design-part2.md",
    "chapter-04-system-design-part3.md",
    "chapter-05-implementation-part1.md",
    "chapter-05-implementation-part2.md",
    "chapter-05-implementation-part3.md",
    "chapter-06-testing-evaluation.md",
    "chapter-07-conclusion.md",
    "references.md",
    "appendix-a-architecture-diagrams.md",
    "appendix-b-api-documentation.md",
    "appendix-c-database-schema.md",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIAGRAMS_DIR = os.path.join(SCRIPT_DIR, "diagrams")

FONT_NAME = "Times New Roman"
BLACK = RGBColor(0, 0, 0)
BODY_SIZE = Pt(11)
TITLE_SIZE = Pt(15)
HEADING_SIZES = {
    1: Pt(14),
    2: Pt(13),
    3: Pt(12),
    4: Pt(11),
}
CAPTION_STYLE = "Caption"
CODE_STYLE = "Thesis Code Block"

# Map diagram headings/contexts to their PNG images. These replace matching
# Markdown diagram code blocks.
DIAGRAM_IMAGES = {
    "3.5 System Context Diagram": "08-c4-context.png",
    "4.6 Deployment Architecture": "10-deployment-summary.png",
    "4.11 AI Coach Architecture": "13-ai-coach-layer-flow.png",
    "4.12.1 Ingestion Flow": "14-rag-ingestion-flow.png",
    "4.12.2 Retrieval Flow": "15-rag-retrieval-flow.png",
    "A.1 High-Level Architecture": "01-high-level-architecture.png",
    "A.2 WebSocket Communication Sequence": "02-websocket-sequence.png",
    "A.3 Quiz Completion Webhook Flow": "03-webhook-flow.png",
    "A.4 RAG Pipeline Flow": "04-rag-pipeline.png",
    "A.5 Spaced Repetition State Machine": "05-sm2-state-machine.png",
    "A.6 Adaptive Infinity Quiz Flow": "20-adaptive-infinity-flow.png",
    "4.1 Architectural Overview": "06-system-overview.png",
}

# Additional diagrams to insert AFTER specific headings (where no ASCII art exists)
# These are new diagrams added to enrich the thesis
INSERT_AFTER_HEADING = {
    "3.4 Use Cases": "07-use-case.png",
    "4.2 Service Responsibilities": "09-c4-container.png",
    "4.6 Deployment Architecture": "10-deployment.png",
    "4.5 Security Architecture": "11-auth-sequence.png",
    "4.8 Database Design": "12-er-diagram.png",
    "4.11 AI Coach Architecture": "13-ai-coach-component.png",
    "4.12 RAG Pipeline Design": "14-ingestion-activity.png",
    "4.13 Spaced Repetition Algorithm": "16-sm2-activity.png",
    "4.15 Question Generation Design": "19-question-generation-flow.png",
    "4.16 Adaptive Infinity Quiz Design": "20-adaptive-infinity-flow.png",
    "5.2 Project Structure": "18-spring-component.png",
    "5.5 Webhook Integration": "17-quiz-gameplay-sequence.png",
    "5.13 BFF API Routes": "11-auth-sequence.png",
    "5.22 Document Ingestion Pipeline": "14-ingestion-activity.png",
}

DIAGRAM_CAPTION_TITLES = {
    "01-high-level-architecture.png": "High-Level Architecture",
    "02-websocket-sequence.png": "WebSocket Communication Sequence",
    "03-webhook-flow.png": "Quiz Completion Webhook Flow",
    "04-rag-pipeline.png": "RAG Pipeline Flow",
    "05-sm2-state-machine.png": "Spaced Repetition State Machine",
    "06-system-overview.png": "System Overview",
    "07-use-case.png": "Use Case Diagram",
    "08-c4-context.png": "System Context Diagram",
    "09-c4-container.png": "C4 Container Diagram",
    "10-deployment.png": "Deployment Architecture",
    "10-deployment-summary.png": "Deployment Environment Summary",
    "11-auth-sequence.png": "Authentication Sequence",
    "12-er-diagram.png": "Entity Relationship Diagram",
    "13-ai-coach-component.png": "AI Coach Component Diagram",
    "13-ai-coach-layer-flow.png": "AI Coach Layer Flow",
    "14-ingestion-activity.png": "Document Ingestion Activity",
    "14-rag-ingestion-flow.png": "RAG Ingestion Flow",
    "15-rag-retrieval-flow.png": "RAG Retrieval Flow",
    "16-sm2-activity.png": "SM-2 Activity Flow",
    "17-quiz-gameplay-sequence.png": "Quiz Gameplay Sequence",
    "18-spring-component.png": "Spring Backend Component Diagram",
    "19-question-generation-flow.png": "Question Generation Flow",
    "20-adaptive-infinity-flow.png": "Adaptive Infinity Quiz Flow",
}


def set_rfonts(rPr, font_name=FONT_NAME):
    """Set all Word font families for a run/style."""
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rFonts.set(qn(attr), font_name)


def format_run(run, size=BODY_SIZE, bold=None, italic=None):
    """Apply thesis-wide run formatting."""
    run.font.name = FONT_NAME
    run.font.size = size
    run.font.color.rgb = BLACK
    run.font.highlight_color = None
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    set_rfonts(run._r.get_or_add_rPr())


def format_style(style, size=BODY_SIZE, bold=None, italic=None):
    """Apply base font formatting to a Word style."""
    try:
        style.font.name = FONT_NAME
        style.font.size = size
        style.font.color.rgb = BLACK
        if bold is not None:
            style.font.bold = bold
        if italic is not None:
            style.font.italic = italic
        set_rfonts(style.element.get_or_add_rPr())
    except Exception:
        return


def configure_document_styles(doc):
    """Normalize document-wide fonts, sizes, colors, and caption/code styles."""
    for style in doc.styles:
        if style.type in (WD_STYLE_TYPE.PARAGRAPH, WD_STYLE_TYPE.CHARACTER, WD_STYLE_TYPE.TABLE):
            format_style(style, BODY_SIZE)

    format_style(doc.styles["Normal"], BODY_SIZE)

    for level, size in HEADING_SIZES.items():
        style_name = f"Heading {level}"
        if style_name in [style.name for style in doc.styles]:
            style = doc.styles[style_name]
            format_style(style, size, bold=True, italic=False)
            style.paragraph_format.space_before = Pt(8)
            style.paragraph_format.space_after = Pt(4)

    if CAPTION_STYLE in [style.name for style in doc.styles]:
        caption_style = doc.styles[CAPTION_STYLE]
    else:
        caption_style = doc.styles.add_style(CAPTION_STYLE, WD_STYLE_TYPE.PARAGRAPH)
    format_style(caption_style, BODY_SIZE, bold=False, italic=True)
    caption_style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption_style.paragraph_format.space_before = Pt(3)
    caption_style.paragraph_format.space_after = Pt(6)

    if CODE_STYLE in [style.name for style in doc.styles]:
        code_style = doc.styles[CODE_STYLE]
    else:
        code_style = doc.styles.add_style(CODE_STYLE, WD_STYLE_TYPE.PARAGRAPH)
    code_style.base_style = doc.styles["Normal"]
    format_style(code_style, BODY_SIZE, bold=False, italic=False)
    code_style.paragraph_format.left_indent = Cm(1)
    code_style.paragraph_format.space_before = Pt(3)
    code_style.paragraph_format.space_after = Pt(3)


def major_number_from_heading(heading_text):
    """Return chapter/appendix id used as the first caption number."""
    if not heading_text:
        return "0"
    appendix = re.match(r"Appendix\s+([A-Z])\b", heading_text, flags=re.IGNORECASE)
    if appendix:
        return appendix.group(1).upper()
    appendix_section = re.match(r"([A-Z])\.\d+", heading_text)
    if appendix_section:
        return appendix_section.group(1).upper()
    chapter = re.match(r"Chapter\s+(\d+)\b", heading_text, flags=re.IGNORECASE)
    if chapter:
        return chapter.group(1)
    numbered = re.match(r"(\d+)(?:\.\d+)*\b", heading_text)
    if numbered:
        return numbered.group(1)
    return "0"


def clean_caption_title(title):
    """Remove Markdown markers and leading section numbers from caption titles."""
    title = re.sub(r"[`*_]", "", title or "").strip()
    title = re.sub(r"^Chapter\s+\d+\s*:\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^Appendix\s+[A-Z]\s*:\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^[A-Z]\.\d+(?:\.\d+)*\s*", "", title)
    title = re.sub(r"^\d+(?:\.\d+)*\s*", "", title)
    return title.strip(" :-") or "Untitled"


class CaptionState:
    """Track per-chapter/per-appendix numbering for object captions."""

    def __init__(self):
        self.counts = {}
        self.current_major = "0"

    def note_heading(self, heading_text):
        major = major_number_from_heading(heading_text)
        if major != "0":
            self.current_major = major

    def next_number(self, object_type, heading_text):
        major = major_number_from_heading(heading_text)
        if major == "0":
            major = self.current_major
        key = (object_type, major)
        self.counts[key] = self.counts.get(key, 0) + 1
        return major, self.counts[key]


def add_complex_field(paragraph, instruction, result_text, italic=False, dirty=False):
    """Add a Word complex field with a visible cached result."""
    begin_run = paragraph.add_run()
    format_run(begin_run, BODY_SIZE, italic=italic)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    if dirty:
        begin.set(qn("w:dirty"), "true")
    begin_run._r.append(begin)

    instr_run = paragraph.add_run()
    format_run(instr_run, BODY_SIZE, italic=italic)
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    instr_run._r.append(instr)

    separate_run = paragraph.add_run()
    format_run(separate_run, BODY_SIZE, italic=italic)
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    separate_run._r.append(separate)

    result_run = paragraph.add_run(result_text)
    format_run(result_run, BODY_SIZE, italic=italic)

    end_run = paragraph.add_run()
    format_run(end_run, BODY_SIZE, italic=italic)
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    end_run._r.append(end)
    return result_run


def add_toc_field(paragraph, instruction):
    """Add a dirty TOC field so Word can build/update the generated list."""
    add_complex_field(
        paragraph,
        instruction,
        "Right-click and choose Update Field if this list is not populated.",
        dirty=True,
    )


def set_update_fields_on_open(doc):
    """Ask Word to update fields when the document opens."""
    settings = doc.settings.element
    update_fields = settings.find(qn("w:updateFields"))
    if update_fields is None:
        update_fields = OxmlElement("w:updateFields")
        settings.append(update_fields)
    update_fields.set(qn("w:val"), "true")


def register_caption_labels(doc):
    """Register custom caption labels so Word exposes them in caption/table dialogs."""
    settings = doc.settings.element
    captions = settings.find(qn("w:captions"))
    if captions is None:
        captions = OxmlElement("w:captions")
        settings.append(captions)

    existing = {
        caption.get(qn("w:name"))
        for caption in captions.findall(qn("w:caption"))
    }
    for label in ("Diagram", "Table"):
        if label in existing:
            continue
        caption = OxmlElement("w:caption")
        caption.set(qn("w:name"), label)
        caption.set(qn("w:pos"), "below")
        captions.append(caption)


def add_caption(doc, captions, object_type, heading_text, title):
    caption = doc.add_paragraph(style=CAPTION_STYLE)
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    major, count = captions.next_number(object_type, heading_text)

    prefix = caption.add_run(f"{object_type} {major}.")
    format_run(prefix, BODY_SIZE, italic=True)

    # Word's Table of Figures/Table of Tables recognizes SEQ fields in
    # Caption-styled paragraphs. The visible chapter/appendix prefix is kept
    # explicit so captions preserve the thesis' section-based format.
    add_complex_field(caption, f"SEQ {object_type} \\* ARABIC \\r {count}", str(count), italic=True)

    suffix = caption.add_run(f" - {clean_caption_title(title)}")
    format_run(suffix, BODY_SIZE, italic=True)
    return caption


def add_diagram_image(doc, img_path, captions, heading_text, title=None, width=Inches(5.5)):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run()
    run.add_picture(img_path, width=width)
    caption_title = title or DIAGRAM_CAPTION_TITLES.get(os.path.basename(img_path), heading_text)
    add_caption(doc, captions, "Diagram", heading_text, caption_title)
    doc.add_paragraph()
    return para


def insert_diagram_after_heading(doc, heading_text, captions):
    """Check if a diagram should be inserted after this heading."""
    for key, filename in INSERT_AFTER_HEADING.items():
        if key in heading_text:
            img_path = os.path.join(DIAGRAMS_DIR, filename)
            if os.path.exists(img_path):
                add_diagram_image(doc, img_path, captions, heading_text, width=Inches(5.8))
                return True
    return False


def get_diagram_image_for_heading(heading_text):
    """Find a matching diagram image for the current section heading."""
    for key, filename in DIAGRAM_IMAGES.items():
        if key in heading_text:
            img_path = os.path.join(DIAGRAMS_DIR, filename)
            if os.path.exists(img_path):
                return img_path
    return None


def add_code_paragraph(doc, text):
    """Add a code block paragraph using thesis font rules."""
    para = doc.add_paragraph()
    para.style = doc.styles[CODE_STYLE]
    para.paragraph_format.left_indent = Cm(1)
    para.paragraph_format.space_before = Pt(3)
    para.paragraph_format.space_after = Pt(3)
    run = para.add_run(text)
    format_run(run, BODY_SIZE)
    # Light shading is kept only for code blocks for readability.
    rPr = run._r.get_or_add_rPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), 'F5F5F5')
    rPr.append(shd)
    return para


def add_formatted_runs(paragraph, text):
    """Add runs with bold, italic, code formatting."""
    # Pattern matches: **bold**, *italic*, `code`, and plain text
    pattern = r'(\*\*.*?\*\*|\*.*?\*|`[^`]+`)'
    parts = re.split(pattern, text)
    
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            format_run(run, BODY_SIZE, bold=True)
        elif part.startswith('*') and part.endswith('*') and not part.startswith('**'):
            run = paragraph.add_run(part[1:-1])
            format_run(run, BODY_SIZE, italic=True)
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            format_run(run, BODY_SIZE)
        else:
            run = paragraph.add_run(part)
            format_run(run, BODY_SIZE)


def parse_table(lines, start_idx):
    """Parse a markdown table starting at start_idx. Returns (rows, end_idx)."""
    rows = []
    i = start_idx
    while i < len(lines) and lines[i].strip().startswith('|'):
        row_text = lines[i].strip()
        # Split by | and strip
        cells = [c.strip() for c in row_text.split('|')]
        # Remove empty first and last (from leading/trailing |)
        if cells and cells[0] == '':
            cells = cells[1:]
        if cells and cells[-1] == '':
            cells = cells[:-1]
        rows.append(cells)
        i += 1
    return rows, i


def add_table_to_doc(doc, rows, captions, heading_text):
    """Add a formatted table to the document."""
    if len(rows) < 2:
        return
    
    # Skip separator row (row with ---)
    header = rows[0]
    data_rows = []
    for row in rows[1:]:
        if all(set(cell.strip()) <= set('-| :') for cell in row):
            continue  # skip separator
        data_rows.append(row)
    
    num_cols = len(header)
    table = doc.add_table(rows=1 + len(data_rows), cols=num_cols)
    table.style = 'Table Grid'
    
    # Header row
    for j, cell_text in enumerate(header):
        if j < num_cols:
            cell = table.rows[0].cells[j]
            cell.text = ''
            p = cell.paragraphs[0]
            run = p.add_run(cell_text)
            format_run(run, BODY_SIZE, bold=True)
    
    # Data rows
    for i, row in enumerate(data_rows):
        for j, cell_text in enumerate(row):
            if j < num_cols:
                cell = table.rows[i + 1].cells[j]
                cell.text = ''
                p = cell.paragraphs[0]
                add_formatted_runs(p, cell_text)
                for run in p.runs:
                    format_run(run, BODY_SIZE)
    
    add_caption(doc, captions, "Table", heading_text, heading_text)
    doc.add_paragraph()  # spacing after table


def process_markdown_file(doc, filepath, captions):
    """Process a markdown file and add its content to the Word document."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    i = 0
    in_code_block = False
    code_lines = []
    current_heading = ""  # Track current heading for diagram matching
    
    while i < len(lines):
        line = lines[i]
        
        # Code block start/end
        if line.strip().startswith('```'):
            if in_code_block:
                # End code block - write collected code
                code_text = '\n'.join(code_lines)
                if code_text.strip():
                    img_path = get_diagram_image_for_heading(current_heading)
                    # Prefer curated diagram images for mapped headings.
                    if img_path:
                        add_diagram_image(doc, img_path, captions, current_heading)
                    else:
                        add_code_paragraph(doc, code_text)
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue
        
        if in_code_block:
            code_lines.append(line)
            i += 1
            continue
        
        # Empty line
        if not line.strip():
            i += 1
            continue
        
        # Headings - track current heading for diagram matching
        if line.startswith('# '):
            current_heading = line[2:].strip()
            captions.note_heading(current_heading)
            heading = doc.add_heading(current_heading, level=1)
            for run in heading.runs:
                format_run(run, HEADING_SIZES[1], bold=True, italic=False)
            insert_diagram_after_heading(doc, current_heading, captions)
            i += 1
            continue
        elif line.startswith('## '):
            current_heading = line[3:].strip()
            captions.note_heading(current_heading)
            heading = doc.add_heading(current_heading, level=2)
            for run in heading.runs:
                format_run(run, HEADING_SIZES[2], bold=True, italic=False)
            insert_diagram_after_heading(doc, current_heading, captions)
            i += 1
            continue
        elif line.startswith('### '):
            current_heading = line[4:].strip()
            captions.note_heading(current_heading)
            heading = doc.add_heading(current_heading, level=3)
            for run in heading.runs:
                format_run(run, HEADING_SIZES[3], bold=True, italic=False)
            insert_diagram_after_heading(doc, current_heading, captions)
            i += 1
            continue
        elif line.startswith('#### '):
            current_heading = line[5:].strip()
            captions.note_heading(current_heading)
            heading = doc.add_heading(current_heading, level=4)
            for run in heading.runs:
                format_run(run, HEADING_SIZES[4], bold=True, italic=False)
            i += 1
            continue
        
        # Table
        if line.strip().startswith('|'):
            rows, end_idx = parse_table(lines, i)
            add_table_to_doc(doc, rows, captions, current_heading)
            i = end_idx
            continue
        
        # Horizontal rule
        if line.strip() in ('---', '***', '___'):
            para = doc.add_paragraph()
            run = para.add_run('_' * 60)
            format_run(run, BODY_SIZE)
            i += 1
            continue
        
        # Bullet lists
        bullet_match = re.match(r'^(\s*)[-*]\s+(.*)', line)
        if bullet_match:
            indent = len(bullet_match.group(1))
            text = bullet_match.group(2)
            para = doc.add_paragraph()
            para.style = 'List Bullet'
            if indent >= 2:
                para.paragraph_format.left_indent = Cm(1.5 + (indent // 2) * 0.7)
            add_formatted_runs(para, text)
            i += 1
            continue
        
        # Numbered lists
        num_match = re.match(r'^(\s*)\d+\.\s+(.*)', line)
        if num_match:
            text = num_match.group(2)
            para = doc.add_paragraph()
            para.style = 'List Number'
            add_formatted_runs(para, text)
            i += 1
            continue
        
        # Regular paragraph
        para = doc.add_paragraph()
        add_formatted_runs(para, line)
        i += 1


def paragraph_default_size(paragraph):
    style_name = paragraph.style.name if paragraph.style is not None else ""
    if style_name.startswith("Heading 1"):
        return HEADING_SIZES[1]
    if style_name.startswith("Heading 2"):
        return HEADING_SIZES[2]
    if style_name.startswith("Heading 3"):
        return HEADING_SIZES[3]
    if style_name.startswith("Heading 4"):
        return HEADING_SIZES[4]
    return BODY_SIZE


def iter_all_paragraphs(doc):
    for paragraph in doc.paragraphs:
        yield paragraph
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    yield paragraph
    for section in doc.sections:
        for paragraph in section.header.paragraphs:
            yield paragraph
        for paragraph in section.footer.paragraphs:
            yield paragraph


def normalize_document_formatting(doc):
    """Final guardrail for font family, size, color, and highlighting."""
    for paragraph in iter_all_paragraphs(doc):
        default_size = paragraph_default_size(paragraph)
        for run in paragraph.runs:
            size = run.font.size or default_size
            if size < BODY_SIZE:
                size = BODY_SIZE
            format_run(run, size)


def add_formatted_heading(doc, text, level):
    heading = doc.add_heading(text, level=level)
    size = HEADING_SIZES.get(level, BODY_SIZE)
    for run in heading.runs:
        format_run(run, size, bold=True, italic=False)
    return heading


def add_generated_lists_page(doc):
    """Add page-2 generated lists for diagram and table captions."""
    doc.add_page_break()

    add_formatted_heading(doc, "List of Diagrams", level=1)
    diagram_list = doc.add_paragraph()
    add_toc_field(diagram_list, 'TOC \\h \\z \\c "Diagram"')

    doc.add_paragraph()

    add_formatted_heading(doc, "List of Tables", level=1)
    table_list = doc.add_paragraph()
    add_toc_field(table_list, 'TOC \\h \\z \\c "Table"')


def update_fields_with_word(docx_path):
    """Use Microsoft Word, when available, to populate generated field results."""
    try:
        import win32com.client
    except ImportError:
        print("WARNING: win32com is unavailable; Word fields will update when opened in Word.")
        return False

    word = None
    try:
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        doc = word.Documents.Open(os.path.abspath(docx_path))
        doc.Fields.Update()
        for toc in doc.TablesOfContents:
            toc.Update()
        for tof in doc.TablesOfFigures:
            tof.Update()
        doc.Save()
        doc.Close(False)
        return True
    except Exception as exc:
        print(f"WARNING: Could not update Word fields automatically: {exc}")
        return False
    finally:
        if word is not None:
            word.Quit()


def normalize_saved_docx(docx_path):
    """Reapply formatting after Word populates generated field results."""
    doc = Document(docx_path)
    configure_document_styles(doc)
    set_update_fields_on_open(doc)
    register_caption_labels(doc)
    normalize_document_formatting(doc)
    doc.save(docx_path)


def create_thesis_document():
    """Create the complete thesis Word document."""
    doc = Document()
    configure_document_styles(doc)
    set_update_fields_on_open(doc)
    register_caption_labels(doc)
    captions = CaptionState()
    
    # Page setup
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(3)
    section.right_margin = Cm(2.5)
    
    # Title page
    doc.add_paragraph()
    doc.add_paragraph()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run('GRADUATION THESIS')
    format_run(run, TITLE_SIZE, bold=True, italic=False)
    
    doc.add_paragraph()
    
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run('QAI - AI-Enhanced Quiz and Learning Platform')
    format_run(run, Pt(13), bold=True, italic=False)
    
    doc.add_paragraph()
    doc.add_paragraph()

    add_generated_lists_page(doc)
    
    # Process each file
    for filename in THESIS_FILES:
        filepath = os.path.join(SCRIPT_DIR, filename)
        if os.path.exists(filepath):
            print(f"Processing: {filename}")
            # Add page break between chapters
            doc.add_page_break()
            process_markdown_file(doc, filepath, captions)
        else:
            print(f"WARNING: File not found: {filename}")
    
    normalize_document_formatting(doc)

    # Save
    output_path = os.path.join(SCRIPT_DIR, "QAI_Graduation_Thesis.docx")
    doc.save(output_path)
    if update_fields_with_word(output_path):
        print("Word fields updated.")
    normalize_saved_docx(output_path)
    print(f"\nWord document saved: {output_path}")
    return output_path


if __name__ == '__main__':
    create_thesis_document()
