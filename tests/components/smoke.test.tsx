// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function Hello({ name }: { name: string }) {
  return <button type="button">Hello {name}</button>;
}

describe('jsdom smoke', () => {
  it('renders a component', () => {
    render(<Hello name="Bunlong" />);
    expect(screen.getByRole('button')).toHaveTextContent('Hello Bunlong');
  });
});
