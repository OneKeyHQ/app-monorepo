/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';

let mockShouldRenderPageEveryChildren = true;
let mockSplitViewType = 'unknown';
const mockPageEvery = jest.fn(({ children }: { children: ReactNode }) =>
  mockShouldRenderPageEveryChildren ? children : null,
);
const mockWalletConnectModalContainer = jest.fn(() => null);

jest.mock('@onekeyhq/components', () => ({
  ESplitViewType: {
    MAIN: 'main',
    SUB: 'sub',
    UNKNOWN: 'unknown',
  },
  Page: {
    Every: (props: { children: ReactNode }) => mockPageEvery(props),
  },
  useSplitViewType: () => mockSplitViewType,
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
    mockShouldRenderPageEveryChildren = true;
    mockSplitViewType = 'unknown';
  });

  it('keeps the pairing payload across page remounts until the modal closes', async () => {
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

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
      });
    });

    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);

    mockShouldRenderPageEveryChildren = false;
    view.rerender(<GlobalWalletConnectModalContainer />);

    mockShouldRenderPageEveryChildren = true;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(2);
    });

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: true,
      });
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
      });
    });

    mockShouldRenderPageEveryChildren = false;
    view.rerender(<GlobalWalletConnectModalContainer />);

    mockShouldRenderPageEveryChildren = true;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(2);

    view.unmount();
  });

  it('clears the pairing payload when loading is closed before the modal opens', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:cancelled-before-open',
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    });

    mockShouldRenderPageEveryChildren = false;
    view.rerender(<GlobalWalletConnectModalContainer />);

    mockShouldRenderPageEveryChildren = true;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('renders the modal only in the detail tree for split view', async () => {
    mockSplitViewType = 'main';
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:split-view',
      });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockWalletConnectModalContainer).not.toHaveBeenCalled();

    mockSplitViewType = 'sub';
    view.rerender(<GlobalWalletConnectModalContainer />);

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    });
    view.unmount();
  });
});
