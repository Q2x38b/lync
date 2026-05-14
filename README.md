# Lync

Video-call web app with web-scraped backgrounds.

## Dependencies

- Node.js 20+
- npm (ships with Node)

Install all packages:

```
npm install
```

Main libraries used:

- `react`, `react-dom`, `react-router-dom` — UI and routing
- `vite` — dev server and bundler
- `typescript` — typed JavaScript
- `convex` — backend / server-side actions
- `axios` — HTTP client used by the standalone scraper
- `tailwindcss` + `framer-motion` — styling and animations
- `lucide-react` — icons

## Commands

Run the dev server:

```
npm run dev
```

Build for production:

```
npm run build
```

Preview the production build locally:

```
npm run preview
```

Run the lint checker:

```
npm run lint
```

Run the standalone web scraper from a terminal. The argument is the
search term; defaults to `nature` if you don't pass one:

```
npx tsx src/Scrapper.ts mountains
npx tsx src/Scrapper.ts "city skyline"
npx tsx src/Scrapper.ts
```

Results are written to `src/backgrounds.json`.

Deploy the Convex backend (one-shot push of functions to dev):

```
npx convex dev --once
```

Deploy the Convex backend to production:

```
npx convex deploy
```
