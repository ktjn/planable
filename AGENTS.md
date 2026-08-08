# Planable agent notes

## Project conventions

- Follow the stack and patterns described in `plans/Planable-Project-Plan.md`.
- Keep components small and reusable; prefer extending existing shared components
  over duplicating row/list markup.
- All Dexie/schema changes require a schema version bump in `src/db/db.ts`.
- Write colocated Vitest tests for new repository functions and components
  (use `fake-indexeddb`).

## Recording decisions

Whenever a feature or significant behavior is planned, record the key decisions
in `docs/decisions.md` with the date, the decision, and the rationale. Link back
to the relevant design doc in `docs/superpowers/specs/` when one exists.
