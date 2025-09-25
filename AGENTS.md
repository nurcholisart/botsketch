# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React app entry and UI logic. Key files: `App.jsx` (nodes, toolbar, sidebar, flow logic), `main.jsx` (bootstraps React), `index.css`/`App.css` (styles), `src/assets/` (images).
- `public/`: Static assets served as-is.
- Root: `index.html` (app shell), `vite.config.js` (build/dev), `eslint.config.js` (lint rules), `postcss.config.js` (Tailwind/PostCSS), `package.json` (scripts/deps).

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server (default http://localhost:5173). Hot reload enabled.
- `npm run build`: Production build to `dist/`.
- `npm run preview`: Serve the built app locally for verification.
- `npm run lint`: Lint JS/JSX using ESLint presets for React + hooks.

## Coding Style & Naming Conventions
- Language: modern JS/JSX (ES modules). Indentation: 2 spaces. Prefer functional components and React hooks.
- Components: PascalCase (e.g., `CardNode`, `ExportModal`). Variables/functions: camelCase. Keep file extensions `.jsx` for React components.
- Styling: Tailwind CSS utilities; keep the card visual style consistent via the shared `nbCard` pattern in `App.jsx`. Avoid inline styles except where layout sizing is unavoidable.
- Imports: external packages first, then local paths.
- Node IDs: follow existing prefixes (`u*` user, `b*` bot, `s*` system) to avoid collisions.

## Testing Guidelines
- No formal unit test runner is configured. Basic runtime smoke checks exist in `runSmokeTests()` within `App.jsx`—do not remove or break them.
- Validate changes by running `npm run dev`, exercising typical flows, and checking the browser console for warnings/errors.
- If adding tests, prefer Vitest + Testing Library; place specs under `src/__tests__/` and name files `*.test.jsx`.

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits (e.g., `feat: add system node menu`, `fix: prevent null handle crash`). Keep subjects imperative and concise.
- PRs: include a clear summary, screenshots/GIFs for UI changes, steps to reproduce/test, and linked issues. Ensure `npm run lint` and `npm run build` pass.
- Do not commit secrets or `node_modules/`. Update docs (`README.md`/this file) when behavior or commands change.

## Security & Configuration Tips
- Do not hardcode API keys. If configuration is needed, use Vite env files (e.g., `.env.local`) and access via `import.meta.env`.
