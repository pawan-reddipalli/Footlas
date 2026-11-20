# Footlas web app

Next.js 16 (App Router) with Tailwind CSS 4 and Clerk. See the [root README](../README.md)
to run it and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for how it fits together.

- `src/app/` pages: home, `/play/daily`, `/play/map`, `/play/players`, `/profile`
- `src/components/` game UI, including the SVG `WorldMap`
- `src/lib/auth.tsx` Clerk or local guest mode behind one `useAuthState()` hook
- `src/lib/api.ts` typed calls to the FastAPI backend
