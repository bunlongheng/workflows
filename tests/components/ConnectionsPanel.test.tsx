// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectionsPanel from '@/components/ConnectionsPanel';

function mockFetch(connections: Array<Record<string, unknown>> = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ connections }),
      })
    ) as unknown as typeof fetch
  );
}

describe('ConnectionsPanel', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('renders the Connections title and connectable integrations', async () => {
    render(<ConnectionsPanel onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Connections' })).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Gmail')).toBeInTheDocument();
  });

  it('renders a search input with a 16px font (iOS no-zoom)', () => {
    render(<ConnectionsPanel onClose={vi.fn()} />);
    const search = screen.getByPlaceholderText('Search integrations...');
    expect(search.style.fontSize).toBe('16px');
  });

  it('filters the integration list by the search query', async () => {
    render(<ConnectionsPanel onClose={vi.fn()} />);
    const search = screen.getByPlaceholderText('Search integrations...');
    await userEvent.type(search, 'gmail');
    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
  });

  it('shows the empty state when no integration matches', async () => {
    render(<ConnectionsPanel onClose={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Search integrations...'), 'zzzznope');
    expect(screen.getByText('No integrations match your filter')).toBeInTheDocument();
  });

  it('closes on Escape keypress', async () => {
    const onClose = vi.fn();
    render(<ConnectionsPanel onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes via the Done footer button', async () => {
    const onClose = vi.fn();
    render(<ConnectionsPanel onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes via the header Close button', async () => {
    const onClose = vi.fn();
    render(<ConnectionsPanel onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a connected account when the fetch returns a connection', async () => {
    mockFetch([
      { integration_id: 'stickies', account_name: 'Stickies', connected_at: new Date().toISOString() },
    ]);
    render(<ConnectionsPanel onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/1 of \d+ integrations connected/)).toBeInTheDocument();
    });
  });

  it('focuses a single integration when focusId is provided and hides search', () => {
    render(<ConnectionsPanel onClose={vi.fn()} focusId="hue" />);
    expect(screen.getByRole('heading', { name: 'Philips Hue' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search integrations...')).not.toBeInTheDocument();
  });

  it('connects a non-OAuth integration through the DB endpoint', async () => {
    const postFetch = vi.fn((url: string) => {
      if (url === '/api/connections') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              connections: [],
              connection: { integration_id: 'stickies', account_name: 'Stickies', connected_at: new Date().toISOString() },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ connections: [] }) });
    });
    vi.stubGlobal('fetch', postFetch as unknown as typeof fetch);
    render(<ConnectionsPanel onClose={vi.fn()} focusId="stickies" />);
    // The focused, disconnected view shows a full-width "Connect Stickies" button.
    await userEvent.click(screen.getByRole('button', { name: 'Connect Stickies' }));
    await waitFor(() => {
      expect(postFetch).toHaveBeenCalledWith(
        '/api/connections',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
