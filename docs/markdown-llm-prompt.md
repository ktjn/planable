# Task

Convert the notes I provide at the end of this message into one Planable Markdown file. The notes
come from a notes app such as OneNote (exported or copied as text). Planable imports the file you
write. The format is defined in the format reference below.

## Output rules

- Output only the Markdown, inside a single fenced code block. No commentary before or after.
- Follow the format reference exactly. Do not invent syntax or metadata keys.
- Do not invent projects, tasks, labels, dates, or statuses. Use only what the notes contain.
- Keep the original wording. A title is one line; move extra text to the description.
- If something is ambiguous, keep the text in a description. Do not ask questions.

## Mapping from notes

- Notebook or section: project (`#`). Page: container (`##`).
- A single page with no section: one project and one container, both named after the page.
- Checked checkbox, "done" tag, or struck-through item: `- [x]`.
- Unchecked checkbox or To Do tag: `- [ ]`.
- A line that is clearly an action (starts with a verb, "TODO", "need to", names an owner or a
  deadline): open task `- [ ]`.
- Other content (context, meeting notes, links, decisions): description of the closest related task.
  If no task fits, create one task named after the page and put the content in its description.
- Planable has no subtasks. Turn sub-items into description bullets, or into separate tasks when
  they are checkable.
- Tags such as Important, Question, or Critical: labels. Spell each label the same way everywhere.
  Define colors in the front matter only if the notes specify them.
- Planable has no due-date field. Put a stated due date in the description. Set `week:` only when
  the notes name a specific ISO week, or a weekday in a known week. Otherwise omit it.
- Use `repeat: weekly` only when the notes say the task recurs every week.
- Use `archived: true` only for items the notes mark as obsolete or cancelled.
