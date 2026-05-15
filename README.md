# Automations - Visual Automation Builder

Drag-and-drop visual automation builder with a node-based graph editor for designing automation flows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.1 |
| UI | React 19.0.0, Tailwind CSS |
| Language | TypeScript |
| Graph Editor | @xyflow/react |
| Database | None - client-side state |
| Port | 3008 |

## Architecture

Fully client-side automation editor. All state lives in the browser using React Flow's internal store. Automations are composed of typed nodes connected by bezier-curved edges. No server-side persistence - automations can be exported/imported as JSON.

```
Browser --> React Flow Canvas --> Node/Edge State --> Export JSON
```

## Features

- Drag-and-drop visual automation builder
- Node-based automation flow design
- Connect nodes with bezier curves
- Multiple node types for different automation steps
- Client-side rendering with React Flow
- Export/import automation definitions

## Project Structure

```
automations/
  app/              # Next.js App Router pages
  components/       # React UI components, custom nodes
  public/           # Static assets
  tailwind.config.ts
  next.config.ts
```

## Scripts

```bash
npm run dev        # Start dev server on port 3008
npm run build      # Production build
npm run start      # Start production server
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Required vars:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth for YouTube, Gmail, Calendar
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `ANTHROPIC_API_KEY` - Claude API for AI summarization
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase auth
- `VPS_URL` / `VPS_AUTH_TOKEN` - automations pipeline backend
- `STICKIES_URL` / `STICKIES_TOKEN` - Stickies API for posted summaries
- `NEXT_PUBLIC_APP_URL` - public app URL (OAuth callbacks, MCP)

The pipeline (poll loop, SSE stream, DB writes) runs on the VPS - see `server/` and the `VPS_*` vars. `ALLOWED_ORIGIN` and `CHECK_INTERVAL_SEC` are set on the VPS side, not Vercel.

---

Built by [Bunlong Heng](https://www.bunlongheng.com) | [GitHub](https://github.com/bunlongheng/automations)
