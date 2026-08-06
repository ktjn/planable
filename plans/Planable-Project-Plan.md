# Planable

> A local-first work planning application for engineers and architects.

## Vision

Planable is a lightweight work planning application focused on planning
and executing work---not managing teams.

It is designed to be:

-   Local-first
-   Fast
-   Keyboard-friendly
-   Simple
-   Hosted as a static web application (GitHub Pages)
-   Free from accounts, servers and cloud dependencies

The goal is to replace scattered notes, TODO lists and spreadsheets with
a single personal planning workspace.

------------------------------------------------------------------------

# Design Principles

-   Personal, not collaborative
-   Local-first (IndexedDB)
-   Static deployment
-   Minimal configuration
-   Drag-and-drop driven
-   Keyboard-first
-   Markdown support
-   Responsive desktop-first UI

------------------------------------------------------------------------

# Technology Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   shadcn/ui
-   Base UI
-   Lucide React

## Storage

-   IndexedDB
-   Dexie

## Drag & Drop

-   @dnd-kit

## Deployment

-   GitHub Pages

------------------------------------------------------------------------

# Navigation

The application consists of three primary views.

    Weekly Plan | Kanban | Project...

Projects are represented as dynamic tabs.

------------------------------------------------------------------------

# Weekly Plan

The Weekly Plan is where work is planned.

It is **not** a calendar.

Columns:

    Unplanned
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday

Tasks are dragged from **Unplanned** into weekdays.

Planning is entirely manual.

## Week Rollover

The user starts a new week manually.

Every unfinished task must be resolved:

-   Move to next week
-   Return to project
-   Complete
-   Delete

Nothing is moved automatically.

## Weekly Tasks

Some tasks can be marked as **Repeat every week**.

These are implemented as templates. Starting a new week creates fresh
task instances.

------------------------------------------------------------------------

# Kanban

Execution only.

    Todo
    Doing
    Blocked
    Done

Weekly planning and Kanban are independent.

------------------------------------------------------------------------

# Projects

Each project has its own tab.

Projects contain user-defined containers.

Example:

    Architecture
    Backlog
    Ideas
    Research
    Waiting
    Done

Containers can be created, renamed, reordered and deleted.

------------------------------------------------------------------------

# Tasks

Each task contains:

-   Title
-   Description (Markdown)
-   Labels
-   Project
-   Container
-   Weekly placement
-   Kanban status
-   Completion status

------------------------------------------------------------------------

# Labels

Global labels with colors.

Examples:

-   Architecture
-   Platform
-   Security
-   DevOps
-   Meetings
-   Research

------------------------------------------------------------------------

# Storage

-   IndexedDB
-   Dexie
-   No backend
-   No authentication

------------------------------------------------------------------------

# Import / Export

JSON export/import containing:

-   Projects
-   Containers
-   Tasks
-   Labels
-   Weekly templates
-   Settings

------------------------------------------------------------------------

# MVP

## Phase 1

-   Project management
-   Project tabs
-   Containers
-   Tasks
-   Labels
-   Weekly Plan
-   Kanban
-   Drag & Drop
-   IndexedDB
-   JSON import/export

## Phase 2

-   Weekly rollover
-   Weekly templates
-   Search
-   Keyboard shortcuts
-   Settings

## Phase 3

-   PWA
-   GitHub sync
-   AI features
-   Analytics

------------------------------------------------------------------------

# Non-Goals

-   Collaboration
-   Authentication
-   Comments
-   Attachments
-   Notifications
-   Time tracking
-   Gantt charts
-   Sprint management
-   Story points
-   Server-side storage

------------------------------------------------------------------------

# Goal

Create the fastest and simplest local-first work planning application
for personal use.
