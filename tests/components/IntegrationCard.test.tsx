// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationCard from '@/components/IntegrationCard';
import type { Integration } from '@/data/integrations';

const emojiIntegration: Integration = {
  id: 'webhook',
  name: 'Webhook',
  icon: '🔗',
  color: 'bg-teal-500',
  category: 'Dev',
  triggers: [],
  actions: [],
};

const svgIntegration: Integration = {
  id: 'gmail',
  name: 'Gmail',
  icon: '/icons/gmail.svg',
  color: 'bg-blue-500',
  category: 'Communication',
  triggers: [],
  actions: [],
};

describe('IntegrationCard', () => {
  it('renders the integration name', () => {
    render(<IntegrationCard integration={emojiIntegration} connected onConnect={vi.fn()} />);
    expect(screen.getByText('Webhook')).toBeInTheDocument();
  });

  it('renders an emoji icon as text when icon is not a path', () => {
    render(<IntegrationCard integration={emojiIntegration} connected onConnect={vi.fn()} />);
    expect(screen.getByText('🔗')).toBeInTheDocument();
  });

  it('renders an img with alt for svg-path icons', () => {
    render(<IntegrationCard integration={svgIntegration} connected onConnect={vi.fn()} />);
    const img = screen.getByAltText('Gmail');
    expect(img).toHaveAttribute('src', '/icons/gmail.svg');
  });

  it('exposes a button role with a "Use" aria-label when connected', () => {
    render(<IntegrationCard integration={svgIntegration} connected onConnect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Use Gmail' })).toBeInTheDocument();
  });

  it('exposes a "Connect" aria-label when disconnected', () => {
    render(<IntegrationCard integration={svgIntegration} connected={false} onConnect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeInTheDocument();
  });

  it('fires onConnect with the integration id on click', async () => {
    const onConnect = vi.fn();
    render(<IntegrationCard integration={svgIntegration} connected onConnect={onConnect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use Gmail' }));
    expect(onConnect).toHaveBeenCalledWith('gmail');
  });

  it('fires onConnect on Enter keydown', async () => {
    const onConnect = vi.fn();
    render(<IntegrationCard integration={svgIntegration} connected onConnect={onConnect} />);
    const card = screen.getByRole('button', { name: 'Use Gmail' });
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onConnect).toHaveBeenCalledWith('gmail');
  });

  it('fires onConnect on Space keydown', async () => {
    const onConnect = vi.fn();
    render(<IntegrationCard integration={svgIntegration} connected onConnect={onConnect} />);
    const card = screen.getByRole('button', { name: 'Use Gmail' });
    card.focus();
    await userEvent.keyboard('[Space]');
    expect(onConnect).toHaveBeenCalledWith('gmail');
  });

  it('is draggable only when connected', () => {
    const { rerender } = render(
      <IntegrationCard integration={svgIntegration} connected onConnect={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute('draggable', 'true');
    rerender(<IntegrationCard integration={svgIntegration} connected={false} onConnect={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('draggable', 'false');
  });
});
