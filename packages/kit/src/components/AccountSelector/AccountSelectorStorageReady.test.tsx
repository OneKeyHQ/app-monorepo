/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

let storageReady = false;
let mockIsTravelModeRuntime = false;

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: {
        persistence: mockIsTravelModeRuntime ? 'masked' : 'real',
      },
    }),
  },
}));

jest.mock('../../states/jotai/contexts/accountSelector/atoms', () => ({
  useAccountSelectorStorageReadyAtom: () => [storageReady],
}));

describe('AccountSelectorStorageReady', () => {
  beforeEach(() => {
    storageReady = false;
    mockIsTravelModeRuntime = false;
  });

  it('renders the fallback while storage is not ready', () => {
    render(
      <AccountSelectorStorageReady
        fallback={<div data-testid="storage-ready-fallback" />}
      >
        <div data-testid="storage-ready-content" />
      </AccountSelectorStorageReady>,
    );

    expect(screen.getByTestId('storage-ready-fallback')).toBeTruthy();
    expect(screen.queryByTestId('storage-ready-content')).toBeNull();
  });

  it('renders children after storage becomes ready', () => {
    storageReady = true;

    render(
      <AccountSelectorStorageReady
        fallback={<div data-testid="storage-ready-fallback" />}
      >
        <div data-testid="storage-ready-content" />
      </AccountSelectorStorageReady>,
    );

    expect(screen.getByTestId('storage-ready-content')).toBeTruthy();
    expect(screen.queryByTestId('storage-ready-fallback')).toBeNull();
  });

  it('renders empty-runtime children without waiting for account storage', () => {
    mockIsTravelModeRuntime = true;

    render(
      <AccountSelectorStorageReady
        fallback={<div data-testid="storage-ready-fallback" />}
      >
        <div data-testid="storage-ready-content" />
      </AccountSelectorStorageReady>,
    );

    expect(screen.getByTestId('storage-ready-content')).toBeTruthy();
    expect(screen.queryByTestId('storage-ready-fallback')).toBeNull();
  });
});
