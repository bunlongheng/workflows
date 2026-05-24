// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from '@xyflow/react';
import CodePanel from '@/components/panels/CodePanel';

const triggerNode: Node = {
  id: 't1',
  type: 'triggerNode',
  position: { x: 0, y: 0 },
  data: { integrationId: 'gmail', eventId: 'gmail-t1', eventLabel: 'New Email Received' },
};
const actionNode: Node = {
  id: 'a1',
  type: 'actionNode',
  position: { x: 0, y: 0 },
  data: { integrationId: 'hue', eventId: 'hue-a1', eventLabel: 'Flash Lights' },
};
const edge: Edge = { id: 'e1', source: 't1', target: 'a1' };

describe('CodePanel', () => {
  it('renders the Code View header and DSL badge', () => {
    render(<CodePanel nodes={[]} edges={[]} onClose={vi.fn()} />);
    expect(screen.getByText('Code View')).toBeInTheDocument();
    expect(screen.getByText('DSL')).toBeInTheDocument();
  });

  it('shows an empty-state comment when there are no nodes', () => {
    render(<CodePanel nodes={[]} edges={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/No automations defined yet/)).toBeInTheDocument();
  });

  it('shows the node and edge counts in the footer', () => {
    render(<CodePanel nodes={[triggerNode, actionNode]} edges={[edge]} onClose={vi.fn()} />);
    expect(screen.getByText('2 nodes / 1 edges')).toBeInTheDocument();
  });

  it('generates a trigger block with integration name and event', () => {
    render(<CodePanel nodes={[triggerNode]} edges={[]} onClose={vi.fn()} />);
    expect(screen.getByText('trigger')).toBeInTheDocument();
    expect(screen.getByText(/Gmail Flow 1/)).toBeInTheDocument();
    expect(screen.getByText(/New Email Received/)).toBeInTheDocument();
  });

  it('generates an action block with a depends_on for chained nodes', () => {
    render(<CodePanel nodes={[triggerNode, actionNode]} edges={[edge]} onClose={vi.fn()} />);
    expect(screen.getByText('action')).toBeInTheDocument();
    expect(screen.getByText(/depends_on/)).toBeInTheDocument();
    expect(screen.getByText(/Flash Lights/)).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<CodePanel nodes={[]} edges={[]} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'x' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies the generated code to the clipboard on Copy', async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CodePanel nodes={[triggerNode]} edges={[]} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('automation("Gmail Flow 1")'));
  });
});
