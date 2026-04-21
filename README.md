# Workflows - Visual Automation Builder

Drag-and-drop visual workflow builder with a node-based graph editor for designing automation flows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.1 |
| UI | React 19.0.0, Tailwind CSS |
| Language | TypeScript |
| Graph Editor | @xyflow/react |
| Database | None - client-side state |
| Port | 3005 |

## Architecture

Fully client-side workflow editor. All state lives in the browser using React Flow's internal store. Workflows are composed of typed nodes connected by bezier-curved edges. No server-side persistence - workflows can be exported/imported as JSON.

```
Browser --> React Flow Canvas --> Node/Edge State --> Export JSON
```

## Features

- Drag-and-drop visual workflow builder
- Node-based automation flow design
- Connect nodes with bezier curves
- Multiple node types for different automation steps
- Client-side rendering with React Flow
- Export/import workflow definitions

## Project Structure

```
workflows/
  app/              # Next.js App Router pages
  components/       # React UI components, custom nodes
  public/           # Static assets
  tailwind.config.ts
  next.config.ts
```

## Scripts

```bash
npm run dev        # Start dev server on port 3005
npm run build      # Production build
npm run start      # Start production server
```

## Environment Variables

No environment variables needed.

---

Built by [Bunlong Heng](https://www.bunlongheng.com) | [GitHub](https://github.com/bunlongheng/workflows)
