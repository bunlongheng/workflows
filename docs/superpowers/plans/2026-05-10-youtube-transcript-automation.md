# YouTube Transcript Automation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the YouTube integration with "Video Liked" trigger and transcript-processing actions (summarize, mind map, top ideas, presentation) so users can build automation flows that digest YouTube content.

**Architecture:** Extend the existing YouTube integration in `data/integrations.ts` with new triggers/actions. Add YouTube-specific config fields in `NodeConfigPanel`. Create a new "AI Processing" integration for transcript actions (summarize, mind map, ideas, deck). This keeps YouTube as the trigger source and AI Processing as the action handler - matching real IFTTT patterns.

**Tech Stack:** Next.js 15, React 19, @xyflow/react, Tailwind CSS, TypeScript

---

### Task 1: Enhance YouTube Integration Triggers

**Files:**
- Modify: `data/integrations.ts:262-277`

- [ ] **Step 1: Update YouTube triggers to include "Video Liked"**

Replace the YouTube integration entry with enhanced triggers:

```typescript
{
  id: "youtube",
  name: "YouTube",
  icon: "▶️",
  color: "bg-red-600",
  category: "Media",
  triggers: [
    { id: "youtube-t1", label: "New Video Uploaded", description: "Fires when a new video is uploaded to a channel" },
    { id: "youtube-t2", label: "Video Liked", description: "Fires when you like a video on YouTube" },
    { id: "youtube-t3", label: "New Video in Playlist", description: "Fires when a video is added to a watched playlist" },
    { id: "youtube-t4", label: "New Comment on Video", description: "Fires when a new comment is posted on your video" },
  ],
  actions: [
    { id: "youtube-a1", label: "Get Transcript", description: "Fetch the full transcript/captions of a video" },
    { id: "youtube-a2", label: "Upload Video", description: "Upload a video to YouTube" },
    { id: "youtube-a3", label: "Add to Playlist", description: "Add a video to a playlist" },
  ],
},
```

- [ ] **Step 2: Verify the file still exports correctly**

Run: `cd /Users/bheng/Sites/automations && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add data/integrations.ts
git commit -m "feat: enhance YouTube triggers with Video Liked and transcript action"
```

---

### Task 2: Add AI Processing Integration

**Files:**
- Modify: `data/integrations.ts` (add new integration after YouTube)

- [ ] **Step 1: Add AI Processing integration after the YouTube entry**

```typescript
{
  id: "ai-processing",
  name: "AI Processing",
  icon: "🧠",
  color: "bg-emerald-600",
  category: "Productivity",
  triggers: [
    { id: "ai-t1", label: "Processing Complete", description: "Fires when AI finishes processing content" },
  ],
  actions: [
    { id: "ai-a1", label: "Summarize Content", description: "Generate a concise summary from text or transcript" },
    { id: "ai-a2", label: "Extract Top Ideas", description: "Pull out key insights and takeaways from content" },
    { id: "ai-a3", label: "Generate Mind Map", description: "Create a structured mind map from content" },
    { id: "ai-a4", label: "Create Presentation", description: "Turn content into slide deck outline" },
    { id: "ai-a5", label: "Generate Notes", description: "Create structured study/reference notes" },
  ],
},
```

- [ ] **Step 2: Verify type check passes**

Run: `cd /Users/bheng/Sites/automations && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add data/integrations.ts
git commit -m "feat: add AI Processing integration with summarize, mind map, ideas, deck actions"
```

---

### Task 3: Add YouTube Config Fields to NodeConfigPanel

**Files:**
- Modify: `components/panels/NodeConfigPanel.tsx:14-68`

- [ ] **Step 1: Add YouTube config fields inside the `configs` record in `getConfigFields()`**

Add after the `openai` entry (before the closing `};`):

```typescript
youtube: nodeType === 'triggerNode'
  ? [
      { label: 'Channel URL', placeholder: 'https://youtube.com/@channel' },
      { label: 'Playlist Filter', placeholder: 'e.g. Watch Later, Favorites' },
      { label: 'Keyword Filter', placeholder: 'e.g. programming, AI' },
    ]
  : [
      { label: 'Video URL', placeholder: 'https://youtube.com/watch?v=...' },
      { label: 'Language', placeholder: 'en (auto-detect if empty)' },
      { label: 'Include Timestamps', placeholder: 'yes / no' },
    ],
'ai-processing': [
  { label: 'Output Format', placeholder: 'markdown / json / plain text' },
  { label: 'Max Length', placeholder: 'e.g. 500 words, 10 bullet points' },
  { label: 'Focus Topics', placeholder: 'e.g. key takeaways, action items' },
  { label: 'Tone', placeholder: 'professional / casual / academic' },
],
```

- [ ] **Step 2: Verify type check passes**

Run: `cd /Users/bheng/Sites/automations && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add components/panels/NodeConfigPanel.tsx
git commit -m "feat: add YouTube and AI Processing config fields to NodeConfigPanel"
```

---

### Task 4: Update AIBuilder Keyword Map for YouTube Automations

**Files:**
- Modify: `components/AIBuilder.tsx` (keyword mapping section)

- [ ] **Step 1: Read AIBuilder.tsx to find the keyword map**

Read the file to locate the keyword-to-integration mapping.

- [ ] **Step 2: Add keywords for the new integrations**

Add these keywords to the existing map:

```typescript
'transcript': 'youtube',
'liked': 'youtube',
'liked video': 'youtube',
'watch': 'youtube',
'captions': 'youtube',
'summarize': 'ai-processing',
'summary': 'ai-processing',
'mind map': 'ai-processing',
'mindmap': 'ai-processing',
'top ideas': 'ai-processing',
'ideas': 'ai-processing',
'presentation': 'ai-processing',
'deck': 'ai-processing',
'slides': 'ai-processing',
'notes': 'ai-processing',
'digest': 'ai-processing',
```

- [ ] **Step 3: Add an example prompt pill for the YouTube automation**

Add to the example prompts array:

```typescript
"When I like a YouTube video, get transcript and summarize it"
```

- [ ] **Step 4: Verify type check**

Run: `cd /Users/bheng/Sites/automations && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add components/AIBuilder.tsx
git commit -m "feat: add YouTube transcript and AI processing keywords to AIBuilder"
```

---

### Task 5: Update Code Panel DSL to Handle New Integrations

**Files:**
- Modify: `components/panels/CodePanel.tsx` (no changes needed if generic - verify)

- [ ] **Step 1: Verify CodePanel works with new integrations**

The CodePanel generates DSL from nodes/edges generically using `integrations.find()`. Since we added new integrations to the data file, it should work automatically. Verify by checking that `getIntegrationMeta('ai-processing')` and `getIntegrationMeta('youtube')` would resolve correctly.

- [ ] **Step 2: Manual test in browser**

1. Open `http://localhost:3008`
2. Drag YouTube from sidebar to canvas
3. Select "Video Liked" trigger
4. Drag AI Processing from sidebar
5. Select "Summarize Content" action
6. Connect the two nodes
7. Click `</> Code` button
8. Verify the DSL shows the automation correctly

- [ ] **Step 3: Commit (if any fixes needed)**

```bash
git add components/panels/CodePanel.tsx
git commit -m "fix: ensure CodePanel handles YouTube and AI Processing integrations"
```

---

### Task 6: Add Pre-built Example Flow for YouTube Transcript Automation

**Files:**
- Modify: `components/FlowCanvas.tsx:27-143` (initialNodes and initialEdges)

- [ ] **Step 1: Add a 4th example flow to initialNodes**

Add after the Stripe/Mailchimp flow (Flow 3):

```typescript
// Flow 4: YouTube → AI Processing (Transcript → Summary)
{
  id: 'trigger-4',
  type: 'triggerNode',
  position: { x: 80, y: 680 },
  data: {
    integrationId: 'youtube',
    integrationName: 'YouTube',
    icon: '▶️',
    color: 'bg-red-600',
    eventLabel: 'Video Liked',
    type: 'trigger',
  },
},
{
  id: 'action-6',
  type: 'actionNode',
  position: { x: 380, y: 680 },
  data: {
    integrationId: 'youtube',
    integrationName: 'YouTube',
    icon: '▶️',
    color: 'bg-red-600',
    eventLabel: 'Get Transcript',
    type: 'action',
  },
},
{
  id: 'action-7',
  type: 'actionNode',
  position: { x: 680, y: 680 },
  data: {
    integrationId: 'ai-processing',
    integrationName: 'AI Processing',
    icon: '🧠',
    color: 'bg-emerald-600',
    eventLabel: 'Summarize Content',
    type: 'action',
  },
},
```

- [ ] **Step 2: Add edges for the new flow to initialEdges**

```typescript
{ id: 'e9-10', source: 'trigger-4', target: 'action-6', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
{ id: 'e10-11', source: 'action-6', target: 'action-7', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
```

- [ ] **Step 3: Verify type check**

Run: `cd /Users/bheng/Sites/automations && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Visual verification**

Open `http://localhost:3008` and confirm the 4th flow row appears on the canvas showing: YouTube (Video Liked) -> YouTube (Get Transcript) -> AI Processing (Summarize Content)

- [ ] **Step 5: Commit**

```bash
git add components/FlowCanvas.tsx
git commit -m "feat: add YouTube transcript automation as pre-built example flow"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | Adds "Video Liked" trigger + "Get Transcript" action to YouTube |
| 2 | Creates new "AI Processing" integration (summarize, mind map, ideas, deck, notes) |
| 3 | Adds config fields for YouTube and AI Processing in the config panel |
| 4 | Updates AIBuilder keywords so natural language works (e.g. "summarize liked video") |
| 5 | Verifies CodePanel DSL renders correctly for new integrations |
| 6 | Adds a pre-built example flow on the canvas demonstrating the full chain |

After all tasks, the user can:
1. See a YouTube -> Transcript -> Summarize flow on the canvas
2. Drag YouTube and select "Video Liked" as trigger
3. Chain it to "Get Transcript" then to AI Processing actions
4. Configure each node (channel filter, output format, etc.)
5. Use AI Builder with prompts like "When I like a video, summarize it"
6. View the automation as code in the Code Panel
