/** @jest-environment jsdom */
import { WebPerformanceMonitorContainer } from '.';

import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [
    { enabled: true, settings: { showPerformanceMonitorV2: true } },
  ],
}));
jest.mock('../../../components/WebPerformanceMonitor', () => {
  const { OneKeyLocalError } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/errors')
  >('@onekeyhq/shared/src/errors');
  throw new OneKeyLocalError('chunk failed to load');
});

it('drops the monitor, not the app, when its chunk fails to load', async () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  render(
    <div>
      <WebPerformanceMonitorContainer />
      <span>wallet</span>
    </div>,
  );
  await waitFor(() => expect(consoleError).toHaveBeenCalled());
  expect(screen.getByText('wallet')).toBeTruthy();
  consoleError.mockRestore();
});
