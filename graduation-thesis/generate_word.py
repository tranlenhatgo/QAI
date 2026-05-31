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

# Map diagram headings/contexts to their PNG images
# When we encounter a code block with ASCII art (lines with box-drawing chars),
# we check if there's a matching diagram image to use instead.
DIAGRAM_IMAGES = {
    "A.1 High-Level Architecture": "01-high-level-architecture.png",
    "A.2 WebSocket Communication Sequence": "02-websocket-sequence.png",
    "A.3 Quiz Completion Webhook Flow": "03-webhook-flow.png",
    "A.4 RAG Pipeline Flow": "04-rag-pipeline.png",
    "A.5 Spaced Repetition State Machine": "05-sm2-state-machine.png",
    "4.1 Architectural Overview": "06-system-overview.png",
}

# Additional diagrams to insert AFTER specific headings (where no ASCII art exists)
# These are new diagrams added to enrich the thesis
INSERT_AFTER_HEADING = {
    "3.4 Use Cases": "07-use-case.png",
    "3.5 System Context Diagram": "08-c4-context.png",
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


def insert_diagram_after_heading(doc, heading_text):
    """Check if a diagram should be inserted after this heading."""
    for key, filename in INSERT_AFTER_HEADING.items():
        if key in heading_text:
            img_path = os.path.join(DIAGRAMS_DIR, filename)
            if os.path.exists(img_path):
                # Add a small caption
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = cap.add_run()
                run.add_picture(img_path, width=Inches(5.8))
                doc.add_paragraph()  # spacing
                return True
    return False


def set_cell_shading(cell, color):
    """Set background shading of a table cell."""
    shading_elm = OxmlElement('w:shd')
    shading_elm.set(qn('w:fill'), color)
    shading_elm.set(qn('w:val'), 'clear')
    cell._tc.get_or_add_tcPr().append(shading_elm)


def is_ascii_diagram(text):
    """Detect if a code block is an ASCII art diagram (box-drawing characters)."""
    box_chars = set('┌┐└┘├┤┬┴┼─│▼▲►◄▽△▷◁═║╔╗╚╝╠╣╦╩╬┃━┏┓┗┛┣┫┳┻╋')
    line_count = text.count('\n')
    box_count = sum(1 for c in text if c in box_chars)
    # If more than 20 box-drawing chars and at least 5 lines, it's likely a diagram
    return box_count > 20 and line_count >= 5


def get_diagram_image_for_heading(heading_text):
    """Find a matching diagram image for the current section heading."""
    for key, filename in DIAGRAM_IMAGES.items():
        if key in heading_text:
            img_path = os.path.join(DIAGRAMS_DIR, filename)
            if os.path.exists(img_path):
                return img_path
    return None


def add_code_paragraph(doc, text):
    """Add a code block paragraph with monospace font and gray background."""
    para = doc.add_paragraph()
    para.style = doc.styles['No Spacing'] if 'No Spacing' in [s.name for s in doc.styles] else None
    para.paragraph_format.left_indent = Cm(1)
    para.paragraph_format.space_before = Pt(2)
    para.paragraph_format.space_after = Pt(2)
    run = para.add_run(text)
    run.font.name = 'Consolas'
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(0x1E, 0x1E, 0x1E)
    # Add shading
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
            run.bold = True
        elif part.startswith('*') and part.endswith('*') and not part.startswith('**'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9)
            # gray background for inline code
            rPr = run._r.get_or_add_rPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:fill'), 'E8E8E8')
            rPr.append(shd)
        else:
            paragraph.add_run(part)


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


def add_table_to_doc(doc, rows):
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
            run.bold = True
            run.font.size = Pt(9)
            set_cell_shading(cell, 'D9E2F3')
    
    # Data rows
    for i, row in enumerate(data_rows):
        for j, cell_text in enumerate(row):
            if j < num_cols:
                cell = table.rows[i + 1].cells[j]
                cell.text = ''
                p = cell.paragraphs[0]
                add_formatted_runs(p, cell_text)
                for run in p.runs:
                    run.font.size = Pt(9)
    
    doc.add_paragraph()  # spacing after table


def process_markdown_file(doc, filepath):
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
                    # Check if this is an ASCII diagram that should be an image
                    if is_ascii_diagram(code_text):
                        img_path = get_diagram_image_for_heading(current_heading)
                        if img_path:
                            # Insert diagram image instead of ASCII art
                            para = doc.add_paragraph()
                            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            run = para.add_run()
                            run.add_picture(img_path, width=Inches(5.5))
                            doc.add_paragraph()  # spacing
                        else:
                            # No matching image, keep as code
                            add_code_paragraph(doc, code_text)
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
            heading = doc.add_heading(current_heading, level=1)
            heading.runs[0].font.size = Pt(18)
            insert_diagram_after_heading(doc, current_heading)
            i += 1
            continue
        elif line.startswith('## '):
            current_heading = line[3:].strip()
            doc.add_heading(current_heading, level=2)
            insert_diagram_after_heading(doc, current_heading)
            i += 1
            continue
        elif line.startswith('### '):
            current_heading = line[4:].strip()
            doc.add_heading(current_heading, level=3)
            insert_diagram_after_heading(doc, current_heading)
            i += 1
            continue
        elif line.startswith('#### '):
            doc.add_heading(line[5:].strip(), level=4)
            i += 1
            continue
        
        # Table
        if line.strip().startswith('|'):
            rows, end_idx = parse_table(lines, i)
            add_table_to_doc(doc, rows)
            i = end_idx
            continue
        
        # Horizontal rule
        if line.strip() in ('---', '***', '___'):
            doc.add_paragraph('_' * 60)
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


def create_thesis_document():
    """Create the complete thesis Word document."""
    doc = Document()
    
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
    run.bold = True
    run.font.size = Pt(24)
    
    doc.add_paragraph()
    
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run('QAI — AI-Enhanced Quiz and Learning Platform')
    run.bold = True
    run.font.size = Pt(16)
    
    doc.add_paragraph()
    doc.add_paragraph()
    
    # Process each file
    for filename in THESIS_FILES:
        filepath = os.path.join(SCRIPT_DIR, filename)
        if os.path.exists(filepath):
            print(f"Processing: {filename}")
            # Add page break between chapters
            doc.add_page_break()
            process_markdown_file(doc, filepath)
        else:
            print(f"WARNING: File not found: {filename}")
    
    # Save
    output_path = os.path.join(SCRIPT_DIR, "QAI_Graduation_Thesis.docx")
    doc.save(output_path)
    print(f"\nWord document saved: {output_path}")
    return output_path


if __name__ == '__main__':
    create_thesis_document()
