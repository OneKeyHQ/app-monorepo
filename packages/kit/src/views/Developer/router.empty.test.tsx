/** @jest-environment jsdom */
import { Suspense, lazy } from 'react';

import { render, screen, waitFor } from '@testing-library/react';

describe('production Gallery stub', () => {
  it('keeps Zcash settings renderable when production resolves Gallery to the stub', async () => {
    const DebugSettings = lazy(async () => {
      const { ZcashDebugSettings } = await import('./router.empty');
      return { default: ZcashDebugSettings };
    });

    render(
      <Suspense fallback={<div data-testid="settings-loading" />}>
        <div data-testid="privacy-settings-content">
          <DebugSettings />
        </div>
      </Suspense>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('settings-loading')).toBeNull();
      expect(screen.getByTestId('privacy-settings-content')).toBeTruthy();
    });
  });
});
