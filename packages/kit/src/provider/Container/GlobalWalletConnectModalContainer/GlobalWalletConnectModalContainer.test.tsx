/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';

const mockPageEvery = jest.fn(
  ({ children }: { children: ReactNode }) => children,
);
const mockWalletConnectModalContainer = jest.fn(() => null);

jest.mock('@onekeyhq/components', () => ({
  Page: {
    Every: (props: { children: ReactNode }) => mockPageEvery(props),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeIOS: true,
  },
}));

jest.mock(
  '../../../components/WalletConnect/WalletConnectModalContainer',
  () => ({
    WalletConnectModalContainer: () => mockWalletConnectModalContainer(),
  }),
);

describe('GlobalWalletConnectModalContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the iOS page gate before lazily loading the modal', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    expect(mockPageEvery).toHaveBeenCalledTimes(1);
    expect(mockWalletConnectModalContainer).not.toHaveBeenCalled();

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:test-pairing-uri',
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });

    view.unmount();
  });
});
