import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { HelpProvider } from '../HelpProvider';
import { HelpOverlay } from './HelpOverlay';

function renderWithHelp(route: 'review' | 'other') {
  render(
    <HelpProvider>
      <HelpOverlay route={route} />
    </HelpProvider>,
  );
}

async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
}

describe('HelpOverlay', () => {
  it('review route: renders review shortcuts', async () => {
    renderWithHelp('review');
    await openPanel();
    expect(screen.getByText('Show answer / Pass (Good)')).toBeInTheDocument();
    expect(screen.getByText('Fail (Again)')).toBeInTheDocument();
    expect(screen.getByText('Suspend card')).toBeInTheDocument();
  });

  it('other route: renders only toggle/close shortcuts', async () => {
    renderWithHelp('other');
    await openPanel();
    expect(screen.getByText('Toggle this panel')).toBeInTheDocument();
    expect(screen.getByText('Close panel')).toBeInTheDocument();
    expect(screen.queryByText('Show answer / Pass (Good)')).not.toBeInTheDocument();
    expect(screen.queryByText('Unsuspend hovered card')).not.toBeInTheDocument();
  });
});
