// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import MobileWizard from '@/components/MobileWizard';

describe('MobileWizard', () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as unknown as typeof fetch
    );
  });

  it('starts on step 1 (Choose Trigger) and lists trigger integrations', () => {
    render(<MobileWizard />);
    expect(screen.getByText('Choose Trigger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gmail/ })).toBeInTheDocument();
  });

  it('step 1 -> step 2 shows the integration event list', async () => {
    render(<MobileWizard />);
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    expect(screen.getByText('Gmail - Event')).toBeInTheDocument();
    expect(screen.getByText('New Email Received')).toBeInTheDocument();
  });

  it('step 2 -> step 3 shows the Configure Trigger step with fields', async () => {
    render(<MobileWizard />);
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    await userEvent.click(screen.getByText('Subject Match'));
    expect(screen.getByText('Configure Trigger')).toBeInTheDocument();
    expect(screen.getByText('Subject contains')).toBeInTheDocument();
  });

  it('config text inputs use a 16px font size to prevent iOS zoom', async () => {
    render(<MobileWizard />);
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    await userEvent.click(screen.getByText('Subject Match'));
    const input = screen.getByPlaceholderText('e.g. Invoice, Urgent, Deploy');
    expect(input.style.fontSize).toBe('16px');
  });

  it('walks all 6 steps and creates the automation', async () => {
    render(<MobileWizard />);
    // Step 1: trigger integration
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    // Step 2: trigger event
    await userEvent.click(screen.getByText('New Email Received'));
    // Step 3: configure trigger -> Next
    expect(screen.getByText('Configure Trigger')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Step 4: action integration
    expect(screen.getByText('Choose Action')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Philips Hue/ }));
    // Step 5: action event
    expect(screen.getByText('Philips Hue - Event')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Flash Lights'));
    // Step 6: configure action -> Create
    expect(screen.getByText('Configure Action')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create Automation' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/automations/create', expect.objectContaining({ method: 'POST' }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/automations'));
  });

  it('step 1 back button navigates to /automations', async () => {
    render(<MobileWizard />);
    // top-left back chevron is the first button
    const backBtn = screen.getAllByRole('button')[0];
    await userEvent.click(backBtn);
    expect(push).toHaveBeenCalledWith('/automations');
  });

  it('back button on step 2 returns to step 1', async () => {
    render(<MobileWizard />);
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    expect(screen.getByText('Gmail - Event')).toBeInTheDocument();
    const backBtn = screen.getAllByRole('button')[0];
    await userEvent.click(backBtn);
    expect(screen.getByText('Choose Trigger')).toBeInTheDocument();
  });

  it('shows a duplicate error when the API returns 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'This automation already exists' }) })
      ) as unknown as typeof fetch
    );
    render(<MobileWizard />);
    await userEvent.click(screen.getByRole('button', { name: /Gmail/ }));
    await userEvent.click(screen.getByText('New Email Received'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: /Philips Hue/ }));
    await userEvent.click(screen.getByText('Flash Lights'));
    await userEvent.click(screen.getByRole('button', { name: 'Create Automation' }));
    await waitFor(() => {
      expect(screen.getByText('This automation already exists')).toBeInTheDocument();
    });
  });
});
