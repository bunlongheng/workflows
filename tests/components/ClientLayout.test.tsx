// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// next/dynamic should just return the loaded module's default synchronously for tests.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => <div data-testid="flow-canvas-stub" />;
    return Stub;
  },
}));

// Avoid pulling the real React Flow canvas + its CSS import chain.
vi.mock('@/components/FlowCanvas', () => ({
  default: () => <div data-testid="flow-canvas-stub" />,
}));

import ClientLayout from '@/components/ClientLayout';

describe('ClientLayout (desktop)', () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ connections: [] }) })) as unknown as typeof fetch
    );
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the New Automation header on desktop widths', async () => {
    render(<ClientLayout />);
    await waitFor(() => {
      expect(screen.getByText('New Automation')).toBeInTheDocument();
    });
  });

  it('renders the Sidebar integration cards and the FlowCanvas region', async () => {
    render(<ClientLayout />);
    await waitFor(() => {
      expect(screen.getByTestId('flow-canvas-stub')).toBeInTheDocument();
    });
    expect(screen.getByText('Untitled Flow')).toBeInTheDocument();
  });

  it('navigates back to /automations when the Automations button is clicked', async () => {
    render(<ClientLayout />);
    const back = await screen.findByRole('button', { name: /Automations/ });
    await userEvent.click(back);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/automations'));
  });

  it('does not render the mobile wizard heading on desktop', async () => {
    render(<ClientLayout />);
    await waitFor(() => expect(screen.getByText('New Automation')).toBeInTheDocument());
    expect(screen.queryByText('Choose Trigger')).not.toBeInTheDocument();
  });
});

describe('ClientLayout (mobile)', () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ connections: [] }) })) as unknown as typeof fetch
    );
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the MobileWizard first step on small screens', async () => {
    render(<ClientLayout />);
    await waitFor(() => {
      expect(screen.getByText('Choose Trigger')).toBeInTheDocument();
    });
  });
});
