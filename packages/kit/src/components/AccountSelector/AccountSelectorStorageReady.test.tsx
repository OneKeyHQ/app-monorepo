/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

let storageReady = false;

jest.mock('../../states/jotai/contexts/accountSelector/atoms', () => ({
  useAccountSelectorStorageReadyAtom: () => [storageReady],
}));

describe('AccountSelectorStorageReady', () => {
  beforeEach(() => {
    storageReady = false;
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
});
