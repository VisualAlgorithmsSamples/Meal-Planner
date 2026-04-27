# Meal Planner — Claude Instructions

## Project overview

Single-page meal planning app. React 18 + Vite frontend (`meal-planner.jsx`), plain Node.js HTTP server (`server.js`) for file-based persistence via `data.json`. No TypeScript, no CSS framework, no router — keep it that way unless explicitly asked.

## Stack

- **Frontend**: React 18 (JSX), Vite 6, no TypeScript
- **Backend**: Node.js stdlib only (`http`, `fs`, `path`) — no Express
- **Persistence**: flat `data.json` file via `PATCH /data/:key`
- **Dev**: `npm run dev` (concurrently runs Vite + server.js on port 3001)
- **Prod**: `npm run build` → `npm start` (server serves `dist/`)

## Code conventions

### JSX / React
- Functional components only, no class components
- One default export per file (the main component); named exports for small pure helpers if needed
- `useState` + `useEffect` for local state; custom hooks (e.g. `useFileStorage`) for shared stateful logic
- Keep hooks at the top of components; never call hooks conditionally
- Prefer derived values over extra state — compute from existing state rather than syncing a second piece
- Destructure props at the function signature
- Event handler names: `handle<Event>` (e.g. `handleClick`, `handleSubmit`)

### JavaScript
- ES module syntax (`import`/`export`) in frontend files; CommonJS (`require`) in `server.js` to match Node stdlib style
- Arrow functions for callbacks and component definitions; regular `function` declarations for top-level utilities
- `const` by default, `let` only when reassignment is required, never `var`
- Template literals over string concatenation
- Prefer `?.` and `??` over verbose null checks
- Array methods (`map`, `filter`, `reduce`) over imperative loops in JSX

### Naming
- Components: `PascalCase`
- Hooks: `use<Name>` camelCase
- Constants / static data: `UPPER_SNAKE_CASE`
- Everything else: `camelCase`
- Boolean variables/props: prefix with `is`, `has`, or `show` (e.g. `isOpen`, `showAddDish`)

### Styling
- Inline styles via the `style` prop — no CSS files, no CSS-in-JS library
- Keep style objects close to the element; extract to a named const only if reused in ≥3 places
- Use numeric pixel values, not strings, for numeric CSS properties (e.g. `{ padding: 8 }` not `"8px"`)

### File structure
- All frontend logic lives in `meal-planner.jsx` unless a file grows past ~600 lines, at which point split by feature
- `main.jsx` is the React entry point only — no logic there
- `server.js` handles data persistence only — no business logic

## Response style

- Be concise. Skip preamble; go straight to the change or answer.
- Show diffs or targeted edits, not full file rewrites, unless the change is pervasive.
- No trailing summaries of what was just done — the diff speaks for itself.
- If a request is ambiguous, state the assumption and proceed rather than asking clarifying questions.
- Prefer one focused suggestion over a menu of options.
- No emojis.

## What NOT to do

- Do not add TypeScript, PropTypes, or a CSS framework unless explicitly asked.
- Do not introduce a state management library (Redux, Zustand, etc.) — hooks are sufficient.
- Do not add a router — this is intentionally a single view with tab/state-based navigation.
- Do not add error boundaries, loading skeletons, or other polish unless the task calls for it.
- Do not wrap `server.js` in Express or any other framework.
- Do not add comments that describe what the code does — only comment when the *why* is non-obvious.
