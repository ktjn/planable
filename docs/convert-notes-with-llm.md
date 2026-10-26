# Convert notes to a Planable plan with an LLM

Use an LLM to turn notes from OneNote (or any notes app) into a Markdown file that Planable
imports. Planable never sees or sends your notes; you move text between your notes app, the LLM,
and Planable yourself.

NOTE: Pasting notes into an LLM sends them to that provider. Do not paste anything you are not
allowed to share with it.

## Steps

1. **Back up first.** Settings → Data → **Export** (JSON). Markdown import is additive and has no
   undo.
2. **Get the notes out of OneNote.** Pick one:
   - Copy the page text (`Ctrl+A`, `Ctrl+C`) and paste it into the LLM chat.
   - Export the page or section as Word (`.docx`) or PDF and attach it to an LLM chat that accepts
     files. Menu names vary by OneNote version; OneNote for the web has no export, so use copy and
     paste there.
3. **Copy the prompt.** Settings → Data → **Copy LLM prompt**. It contains the conversion
   instructions and the full [format reference](markdown-format.md).
4. **Ask the LLM.** Paste the prompt into the chat, then paste or attach the notes below it.
5. **Save the answer** as `plan.md`.
6. **Review it.** Check project and container names, task titles, and labels. LLMs can drop or
   reword items.
7. **Import.** Settings → Data → **Import Markdown**. Read the warnings; the rest of the file is
   imported even if some lines were rejected.

## Tips

- Convert one section at a time. Long notebooks hit LLM output limits.
- Import several files freely. Projects, containers, and labels with the same name are reused.
- Importing the same file twice duplicates its tasks. Import a corrected file only after deleting
  the first import's tasks, or import just the corrections.
- If the LLM output has problems, the import warnings give line numbers. Paste them back into the
  chat and ask for a corrected file.
- Change the instructions by editing [`markdown-llm-prompt.md`](markdown-llm-prompt.md). The app
  embeds that file and the format reference at build time.

## What the prompt asks for

| Notes | Planable |
|-------|----------|
| Notebook or section | Project |
| Page | Container |
| Checked / unchecked checkbox or To Do tag | `- [x]` / `- [ ]` task |
| Clear action items | Open task |
| Context, meeting notes, links | Task description |
| Tags (Important, Question, ...) | Labels |
| Stated due date | Written in the description (there is no due-date field) |
| Named week or weekday | `week:` metadata |
