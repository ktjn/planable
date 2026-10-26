# Markdown import & export

Planable can export your workspace as a readable Markdown file and import Markdown back in.
Use it to review a plan in any editor, hand-write or generate tasks in bulk (for example with an
LLM), and move plans between browsers.

- **Export**: Settings → Data → **Export Markdown** downloads `planable-export.md`.
- **Import**: Settings → Data → **Import Markdown** adds the file's contents to your data.

NOTE: Markdown is not a full backup. Use the JSON **Export** / **Import** for backups. See
[Markdown vs JSON](#markdown-vs-json).

## Quick start

Paste a checklist into a `.md` file and import it. Tasks land in the Inbox:

```markdown
- [ ] Renew domain registration
- [x] Reply to support emails
```

Add structure with headings. `#` is a project, `##` is a container:

```markdown
# Website Redesign

## Frontend
- [ ] Fix nav overlap on mobile
- [ ] Add dark mode
```

## Structure

| Markdown | Meaning |
|----------|---------|
| `---` front matter | Optional. Format version and label definitions (colors). |
| `# Name` | Project. |
| `## Name` | Container inside the current project. |
| `- labels: …`, `- kanban: …`, `- archived: …` | Container metadata. Must come directly after the `##` heading, before the first task. |
| `- [ ] Title` / `- [x] Title` | Task (open / completed). A bullet without a checkbox is an open task. |
| `  - key: value` (indented under a task) | Task metadata. Must directly follow the task line. |
| Indented text after a blank line | Task description. |

Rules:

- Order in the file is order in the app.
- Headings of level 3–6 are ignored with a warning.
- Tasks before any `##` go to a container named `General` in the current project.
- Tasks before any heading go to the `Inbox` project and container.
- `*` and `+` bullets work like `-`.
- Fenced code blocks, HTML comments, and horizontal rules outside tasks are ignored.
- Any other text outside a task is ignored. The import reports how many lines were skipped.

### Container metadata

| Key | Value | Notes |
|-----|-------|-------|
| `labels` | Comma-separated label names | See [Labels](#labels). |
| `kanban` | `Todo`, `Doing`, `Blocked`, `Done` | Puts the container on the Kanban board. Omit to keep it off. |
| `archived` | `true` / `false` | Archived containers are not placed on the Kanban board. |

### Task metadata

| Key | Value | Notes |
|-----|-------|-------|
| `labels` | Comma-separated label names | See [Labels](#labels). |
| `week` | `<ISO week> <day>`, e.g. `2026-W43 Tue` | Day is `Mon`–`Fri` or `Unplanned`. Day is optional (defaults to `Unplanned`). |
| `repeat` | `weekly` | Repeat every week. Creates a week template. Uses the active week if `week` is missing. |
| `completed` | ISO 8601 timestamp, e.g. `2026-10-20T09:30:00.000Z` | Only used when the checkbox is `[x]`. Defaults to the import time. |
| `archived` | `true` / `false` | Archived tasks cannot be scheduled; `week` and `repeat` are ignored with a warning. |

Metadata lines are indented two spaces (or a tab) and must follow the task line with no blank line in
between. The first line that is not a metadata line, or the first blank line, ends the metadata.

### Descriptions

Indent description lines two spaces (or a tab). Start with a blank line to separate it from metadata.
Blank lines, lists, headings, and fenced code inside the description are kept as written.

```markdown
- [ ] Fix nav overlap on mobile
  - labels: Bug

  Reported by QA on iOS Safari.

  ## Not a heading
  This stays part of the description.
```

If you write no metadata, text indented directly under the task is the description.

### Labels

- Reference labels by name, case-insensitive.
- Escape a comma inside a name with `\,` and a backslash with `\\`.
- Unknown names create new labels with the default color `#3b82f6`.
- Define colors in the front matter. One JSON object per line:

```markdown
---
planable: 1
labels:
  - {"name": "Bug", "color": "#ef4444"}
---
```

- Colors must be `#rrggbb`. Anything else falls back to the default color.
- A label that already exists keeps its color.

## Import behavior

Markdown import is **additive**. It never deletes or overwrites existing data.

1. Labels, projects, and containers are matched by name (case-insensitive). Containers are matched
   within their project.
2. Matches are reused. Metadata on a heading that matches an existing project or container is
   ignored; its tasks are appended.
3. Everything else is created with new ids and appended after existing items.
4. Tasks are always created. Importing the same file twice duplicates its tasks.
5. `repeat: weekly` also creates the matching week template.
6. Problems (bad dates, unknown statuses, ignored text) are reported as warnings; valid content is
   still imported. A file with no projects, tasks, or labels is rejected.

## Markdown vs JSON

| | Markdown | JSON |
|---|----------|------|
| Readable and editable | Yes | No |
| Import mode | Adds to existing data | Replaces all data |
| Ids preserved | No (new ids on import) | Yes |
| Settings (e.g. active week) | No | Yes |
| Manual order in the All Tasks view | No (imported tasks go last) | Yes |
| Order of projects, containers, and tasks in a container | Yes (file order) | Yes |
| Order within a weekly day column | Approximate (follows file order) | Yes |
| Week templates | Derived from `repeat: weekly` | Yes |

Use JSON for backups and restores. Use Markdown for reading, editing, and bulk authoring.

## Full example

The tests parse this example, so it stays valid.

````markdown planable-example
---
planable: 1
labels:
  - {"name": "Bug", "color": "#ef4444"}
  - {"name": "Feature", "color": "#3b82f6"}
  - {"name": "Needs review", "color": "#a855f7"}
---

# Inbox

## Inbox
- [ ] Renew domain registration

# Website Redesign

## Frontend
- labels: Bug, Feature
- kanban: Doing

- [ ] Fix nav overlap on mobile
  - labels: Bug, Needs review
  - week: 2026-W43 Tue

  Reported by QA on iOS Safari.

  Repro:

  ```sh
  open https://example.com/nav
  ```
- [x] Set up CI pipeline
  - completed: 2026-10-20T09:30:00.000Z
- [ ] Weekly team sync
  - week: 2026-W43 Fri
  - repeat: weekly

## Legacy Marketing Site
- archived: true

- [ ] Retire old contact form
  - archived: true
````

## References

- Implementation: `src/lib/markdownFormat.ts` (parser and serializer), `src/lib/importExport.ts`
  (`exportMarkdown`, `importMarkdown`).
- Design decisions: [`decisions.md`](decisions.md).
