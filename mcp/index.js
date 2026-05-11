#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const APP_URL = process.env.AUTOMATIONS_URL || 'http://localhost:3008';
const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

const server = new McpServer({ name: 'automations', version: '1.0.0' });

// List all automations
server.tool('list_automations', 'List all configured automations with trigger, action, run count, and status', {}, async () => {
  const res = await fetch(`${VPS_URL}/api/automations/list`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// Get automation detail
server.tool('get_automation', 'Get details of a specific automation including execution logs', { id: z.string().describe('Automation UUID') }, async ({ id }) => {
  const res = await fetch(`${VPS_URL}/api/automations/${id}`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// Toggle automation
server.tool('toggle_automation', 'Activate or pause an automation', {
  id: z.string().describe('Automation UUID'),
  active: z.boolean().describe('true to activate, false to pause'),
}, async ({ id, active }) => {
  const res = await fetch(`${VPS_URL}/api/automations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

// Delete automation
server.tool('delete_automation', 'Delete an automation and all its logs', { id: z.string().describe('Automation UUID') }, async ({ id }) => {
  const res = await fetch(`${VPS_URL}/api/automations/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

// Process YouTube video
server.tool('process_youtube_video', 'Fetch transcript, summarize with Claude, save to Stickies', {
  videoId: z.string().optional().describe('YouTube video ID'),
  videoUrl: z.string().optional().describe('YouTube video URL'),
}, async ({ videoId, videoUrl }) => {
  const res = await fetch(`${APP_URL}/api/youtube/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, videoUrl }),
  });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// Unlike YouTube video
server.tool('unlike_youtube_video', 'Unlike a video on YouTube', { videoId: z.string().describe('YouTube video ID') }, async ({ videoId }) => {
  const res = await fetch(`${APP_URL}/api/youtube/unlike`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId }),
  });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

// List YouTube likes
server.tool('list_youtube_likes', 'List YouTube liked videos with pagination', {
  pageToken: z.string().optional().describe('Pagination token'),
  maxResults: z.number().optional().describe('Results per page (default 20)'),
}, async ({ pageToken, maxResults }) => {
  const params = new URLSearchParams();
  if (pageToken) params.set('pageToken', pageToken);
  if (maxResults) params.set('maxResults', String(maxResults));
  const res = await fetch(`${APP_URL}/api/youtube/likes?${params}`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// YouTube status
server.tool('get_youtube_status', 'Check YouTube connection status and processing history', {}, async () => {
  const res = await fetch(`${VPS_URL}/api/youtube/status`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// Check all connection statuses (live health checks)
server.tool('check_connections', 'Verify which integrations are actually reachable and connected', {}, async () => {
  const res = await fetch(`${APP_URL}/api/connections/status`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// List stored connections from DB
server.tool('list_connections', 'List all integrations marked as connected in the database', {}, async () => {
  const res = await fetch(`${VPS_URL}/api/connections`);
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// Connect an integration
server.tool('connect_integration', 'Mark an integration as connected in the database', {
  integrationId: z.string().describe('Integration ID (e.g. stickies, youtube, hue)'),
  accountName: z.string().optional().describe('Display name for the connection'),
}, async ({ integrationId, accountName }) => {
  const res = await fetch(`${VPS_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId, accountName: accountName || integrationId }),
  });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
