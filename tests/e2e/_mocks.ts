import { Page, Route } from '@playwright/test';

/**
 * Shared API mocking for E2E.
 *
 * The app's /api/** routes proxy to a VPS with dead OAuth tokens + external
 * deps, so live calls are non-deterministic. Every spec installs these mocks
 * via `installMocks(page)` BEFORE navigating, so the UI renders deterministically.
 *
 * `installMocks` returns a small recorder so specs can assert that POST/PATCH/
 * DELETE endpoints were hit with the expected body.
 */

// ---- Fixture data ----------------------------------------------------------

export const AUTO_YT = {
  id: 'auto-yt-1',
  name: 'YouTube Liked -> Gmail',
  trigger_type: 'video_liked',
  action_type: 'send_email',
  active: true,
  action_config: { to: 'me@example.com', subject: 'New liked video' },
  condition: { keyword: 'AI' },
  created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  trigger_integration_name: 'YouTube',
  trigger_integration_type: 'youtube',
  action_integration_name: 'Gmail',
  action_integration_type: 'gmail',
  total_runs: '12',
  success_runs: '10',
  last_run: new Date(Date.now() - 3600000).toISOString(),
};

export const AUTO_GMAIL_MANUAL = {
  id: 'auto-gmail-1',
  name: 'Gmail -> Stickies (manual)',
  trigger_type: 'subject_match',
  action_type: 'create_sticky',
  active: true,
  action_config: { folder: 'Gmail', manual: 'true' },
  condition: { subject: 'Invoice' },
  created_at: new Date(Date.now() - 86400000).toISOString(),
  updated_at: new Date(Date.now() - 86400000).toISOString(),
  trigger_integration_name: 'Gmail',
  trigger_integration_type: 'gmail',
  action_integration_name: 'Stickies',
  action_integration_type: 'stickies',
  total_runs: '4',
  success_runs: '4',
  last_run: new Date(Date.now() - 7200000).toISOString(),
};

export const AUTO_HUE = {
  id: 'auto-hue-1',
  name: 'Gmail -> Hue Flash',
  trigger_type: 'from_match',
  action_type: 'hue_flash',
  active: false,
  action_config: { group: 'Office', color: '#ff0000' },
  condition: { from: 'boss@company.com' },
  created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  trigger_integration_name: 'Gmail',
  trigger_integration_type: 'gmail',
  action_integration_name: 'Philips Hue',
  action_integration_type: 'hue',
  total_runs: '0',
  success_runs: '0',
  last_run: null,
};

export const AUTOMATIONS = [AUTO_YT, AUTO_GMAIL_MANUAL, AUTO_HUE];

export const LOGS_YT = [
  {
    id: 'log-1',
    automation_name: AUTO_YT.name,
    triggered_at: new Date(Date.now() - 3600000).toISOString(),
    trigger_payload: { videoId: 'vid-aaa', title: 'How transformers work' },
    result: 'success',
    detail: 'Summarized and emailed',
    via: 'pipeline',
  },
  {
    id: 'log-2',
    automation_name: AUTO_YT.name,
    triggered_at: new Date(Date.now() - 7200000).toISOString(),
    trigger_payload: { videoId: 'vid-bbb', title: 'Deep dive into RAG' },
    result: 'failed',
    detail: 'No transcript available',
    via: 'pipeline',
  },
];

export const LOGS_HUE = [
  {
    id: 'log-h1',
    automation_name: AUTO_HUE.name,
    triggered_at: new Date(Date.now() - 1800000).toISOString(),
    trigger_payload: { from: 'boss@company.com', subject: 'Urgent' },
    result: 'success',
    detail: 'Flashed Office lights',
    via: 'pipeline',
  },
];

export const LIKES = {
  videos: [
    { videoId: 'vid-aaa', title: 'How transformers work', channel: 'AI Channel', thumbnail: 'https://i.ytimg.com/vi/vid-aaa/mqdefault.jpg', views: '1500000' },
    { videoId: 'vid-bbb', title: 'Deep dive into RAG', channel: 'ML Weekly', thumbnail: 'https://i.ytimg.com/vi/vid-bbb/mqdefault.jpg', views: '23000' },
    { videoId: 'vid-ccc', title: 'Next.js 16 release', channel: 'Vercel', thumbnail: 'https://i.ytimg.com/vi/vid-ccc/mqdefault.jpg', views: '450' },
  ],
  nextPageToken: null,
  totalResults: 3,
};

export const GMAIL_MESSAGES = {
  messages: [
    { id: 'msg-1', subject: 'Invoice #1024', from: 'billing@vendor.com', date: new Date().toISOString(), snippet: 'Your invoice is attached and due in 30 days.' },
    { id: 'msg-2', subject: 'Invoice #1025', from: 'billing@vendor.com', date: new Date().toISOString(), snippet: 'A second invoice for review.' },
  ],
};

export const CONNECTIONS = {
  connections: [
    { integration_id: 'youtube', account_name: 'My Channel', account_email: 'me@example.com', connected_at: new Date(Date.now() - 30 * 86400000).toISOString(), scopes: ['youtube.readonly'] },
    { integration_id: 'gmail', account_name: 'me@example.com', account_email: 'me@example.com', connected_at: new Date(Date.now() - 20 * 86400000).toISOString(), scopes: ['gmail.readonly'] },
    { integration_id: 'stickies', account_name: 'Stickies', connected_at: new Date(Date.now() - 5 * 86400000).toISOString(), scopes: ['read', 'write'] },
  ],
};

export const CONNECTION_STATUS = {
  checks: [
    { id: 'youtube', name: 'YouTube', connected: true, method: 'OAuth token on VPS', detail: 'Token for My Channel' },
    { id: 'stickies', name: 'Stickies', connected: true, method: 'API health check', detail: 'API reachable' },
  ],
};

// ---- Recorder --------------------------------------------------------------

export interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

export interface MockOptions {
  /** Override the list returned by GET /api/automations/list. */
  automations?: typeof AUTOMATIONS;
  /** Map of automation id -> { automation, logs } for GET /api/automations/:id. */
  detail?: Record<string, { automation: unknown; logs: unknown[] }>;
  /** Override likes payload. */
  likes?: typeof LIKES;
  /** Override gmail messages payload. */
  gmailMessages?: typeof GMAIL_MESSAGES;
  /** Force the create endpoint to return 409 (duplicate). */
  createConflict?: boolean;
}

export interface MockHandle {
  /** Every non-GET request that hit a mocked endpoint, in order. */
  requests: RecordedRequest[];
  /** Convenience: last recorded request matching a url substring + method. */
  find(urlPart: string, method?: string): RecordedRequest | undefined;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const DEFAULT_DETAIL: Record<string, { automation: unknown; logs: unknown[] }> = {
  [AUTO_YT.id]: { automation: AUTO_YT, logs: LOGS_YT },
  [AUTO_GMAIL_MANUAL.id]: { automation: AUTO_GMAIL_MANUAL, logs: [] },
  [AUTO_HUE.id]: { automation: AUTO_HUE, logs: LOGS_HUE },
};

/**
 * Install all API mocks. Call BEFORE page.goto().
 */
export async function installMocks(page: Page, opts: MockOptions = {}): Promise<MockHandle> {
  const handle: MockHandle = {
    requests: [],
    find(urlPart, method) {
      return [...this.requests].reverse().find(
        (r) => r.url.includes(urlPart) && (!method || r.method === method)
      );
    },
  };

  const automations = opts.automations ?? AUTOMATIONS;
  const detail = opts.detail ?? DEFAULT_DETAIL;
  const likes = opts.likes ?? LIKES;
  const gmailMessages = opts.gmailMessages ?? GMAIL_MESSAGES;

  // SSE: abort so EventSource onerror fires and never hangs the page.
  await page.route('**/api/events', (route) => route.abort());

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    // Record mutations for assertions.
    if (method !== 'GET') {
      let body: unknown = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
      handle.requests.push({ method, url: req.url(), body });
    }

    // ---- GET endpoints ----
    if (method === 'GET') {
      if (path.endsWith('/api/automations/list')) {
        return json(route, { automations });
      }
      const detailMatch = path.match(/\/api\/automations\/([^/]+)$/);
      if (detailMatch && detailMatch[1] !== 'list') {
        const id = detailMatch[1];
        const d = detail[id];
        if (d) return json(route, { automation: d.automation, logs: d.logs });
        return json(route, { error: 'Not found' }, 404);
      }
      if (path.endsWith('/api/connections')) {
        return json(route, CONNECTIONS);
      }
      if (path.endsWith('/api/connections/status')) {
        return json(route, CONNECTION_STATUS);
      }
      if (path.endsWith('/api/youtube/likes')) {
        return json(route, likes);
      }
      if (path.endsWith('/api/youtube/processed')) {
        return json(route, { processed: ['vid-aaa'] });
      }
      if (path.endsWith('/api/gmail/messages')) {
        return json(route, gmailMessages);
      }
      // Default GET: empty success.
      return json(route, {});
    }

    // ---- POST endpoints ----
    if (method === 'POST') {
      if (path.endsWith('/api/automations/create') || path.endsWith('/api/automations')) {
        if (opts.createConflict) {
          return json(route, { error: 'This automation already exists' }, 409);
        }
        return json(route, { id: 'auto-new-1', ok: true });
      }
      if (path.endsWith('/api/youtube/process')) {
        const b = (req.postDataJSON() || {}) as { videoId?: string };
        return json(route, { success: true, videoId: b.videoId, title: 'Processed Video' });
      }
      if (path.endsWith('/api/youtube/unlike')) {
        return json(route, { ok: true });
      }
      if (path.endsWith('/api/gmail/sticky-from-message')) {
        return json(route, { ok: true, stickyId: 'sticky-1' });
      }
      if (path.endsWith('/api/connections')) {
        const b = (req.postDataJSON() || {}) as { integrationId?: string; accountName?: string };
        return json(route, {
          connection: {
            integration_id: b.integrationId,
            account_name: b.accountName,
            connected_at: new Date().toISOString(),
            scopes: ['read', 'write'],
          },
        });
      }
      return json(route, { ok: true });
    }

    // ---- PATCH ----
    if (method === 'PATCH') {
      return json(route, { ok: true });
    }

    // ---- DELETE ----
    if (method === 'DELETE') {
      return json(route, { ok: true });
    }

    return json(route, {});
  });

  return handle;
}
