# AGENTS.md

## Purpose

This folder contains the source and generated output for the QAI graduation thesis.

The canonical thesis content is the Markdown source files plus diagram assets. The Word document is generated output.

## Source of Truth

- Edit thesis prose in `chapter-*.md`, `appendix-*.md`, and `references.md`.
- Edit diagram source in `diagrams/*.mmd`.
- Edit Word generation behavior in `generate_word.py`.
- Do not manually edit `QAI_Graduation_Thesis.docx` for persistent changes. Update source files or `generate_word.py`, then regenerate the DOCX.
- `ARCHITECTURE.md`, `audit-todo.md`, and `codebase-research-audit.md` are supporting/research documents and are not included in `THESIS_FILES` unless `generate_word.py` is changed.

## Generation Workflow

Run from the repository root:

```powershell
python graduation-thesis/generate_word.py
```

The script processes files in `THESIS_FILES` order and writes:

```text
graduation-thesis/QAI_Graduation_Thesis.docx
```

After any change to Markdown, diagram mappings, formatting, captions, or generated diagrams, regenerate the DOCX before reporting completion.

## Formatting Rules

`generate_word.py` owns thesis-wide formatting:

- Font family: Times New Roman.
- Minimum font size: 11 pt.
- Main title: 15 pt.
- Heading 1: 14 pt.
- Heading 2: 13 pt.
- Heading 3: 12 pt.
- Body, table text, captions, and code blocks: 11 pt.
- Normal document text is black.
- Do not add decorative highlighting to normal paragraphs.
- Inline code should not use background highlighting.
- Code blocks may use light shading for readability.

Implement formatting changes in `generate_word.py`, not by editing the DOCX.

## Captions and Lists

Every generated diagram/image and table must have a caption below it.

Caption format:

```text
Diagram 4.1 - System Overview
Table 3.2 - FR-01: Quiz Management
```

Caption numbering is managed by `CaptionState` in `generate_word.py`.

The DOCX includes a page-2 generated list section:

- List of Diagrams
- List of Tables

The script creates Word field-based entries using `SEQ Diagram`, `SEQ Table`, and TOC fields. It also attempts to use Microsoft Word via `win32com` to update fields automatically. If Word automation is unavailable, fields remain updateable when the document is opened in Word.

## Diagram Handling

There are two diagram insertion paths in `generate_word.py`:

- `INSERT_AFTER_HEADING`: inserts a diagram immediately after a heading when there is no Markdown diagram block for that visual.
- `DIAGRAM_IMAGES`: replaces the Markdown code block under a matching heading with a rendered PNG.

Use `DIAGRAM_IMAGES` when the Markdown contains an ASCII/text diagram that should appear in the DOCX as a rendered image. Use `INSERT_AFTER_HEADING` only for extra diagrams that are intentionally not represented as Markdown code blocks.

When adding a new rendered diagram:

1. Create or update the `.mmd` file in `diagrams/`.
2. Render the matching `.png`.
3. Add the PNG mapping in `generate_word.py`.
4. Add a caption title in `DIAGRAM_CAPTION_TITLES`.
5. Regenerate the DOCX.
6. Verify the old ASCII/text diagram is not duplicated in the DOCX.

`graduation-thesis/diagrams/` is ignored by the repository `.gitignore`; new or changed diagram assets may not appear in normal `git status`.

## Validation

Before reporting DOCX generation work as complete, verify at least:

- `generate_word.py` runs successfully.
- `QAI_Graduation_Thesis.docx` was regenerated.
- Diagram and table counts match caption counts.
- Captions are placed directly below their diagram/table.
- No font size below 11 pt remains in generated text.
- No unexpected highlight/color formatting remains in normal text.

Use Python inspection of the generated DOCX when practical; do not rely only on visual inspection.

## Git Hygiene

- Do not revert unrelated user changes.
- Do not delete or normalize `~$*.docx` lock/temp files unless explicitly asked.
- The DOCX is binary generated output; expect it to show as modified after regeneration.
