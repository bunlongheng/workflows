// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Sidebar from '@/components/Sidebar';
import { integrations } from '@/data/integrations';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ connections: [{ integration_id: 'gmail' }] }),
        })
      ) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a card for every integration', async () => {
    render(<Sidebar onOpenConnections={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(integrations.length);
    });
  });

  it('fetches the connection list on mount', () => {
    render(<Sidebar onOpenConnections={vi.fn()} />);
    expect(fetch).toHaveBeenCalledWith('/api/connections');
  });

  it('marks the fetched integration as connected (Use aria-label)', async () => {
    render(<Sidebar onOpenConnections={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Use Gmail' })).toBeInTheDocument();
    });
    // a not-connected one should read "Connect ..."
    expect(screen.getByRole('button', { name: 'Connect YouTube' })).toBeInTheDocument();
  });

  it('passes onOpenConnections through to cards (fires with id on click)', async () => {
    const onOpen = vi.fn();
    const user = (await import('@testing-library/user-event')).default;
    render(<Sidebar onOpenConnections={onOpen} />);
    const card = await screen.findByRole('button', { name: 'Use Gmail' });
    await user.click(card);
    expect(onOpen).toHaveBeenCalledWith('gmail');
  });

  it('renders even when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    render(<Sidebar onOpenConnections={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});
