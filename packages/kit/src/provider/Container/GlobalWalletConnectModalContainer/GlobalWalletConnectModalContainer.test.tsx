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
        attemptId: 11,
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });

    // the native modal's initial open:false emit carries no attemptId
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
        attemptId: 11,
      });
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
        attemptId: 11,
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

  it('ignores stale terminal events from a superseded attempt and clears on its own', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:first-session',
        attemptId: 1,
      });
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: true,
        attemptId: 1,
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });

    // A second pairing lands while the first modal is still open.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:second-session',
        attemptId: 2,
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(2);
    });

    // Stale terminal events of the superseded attempt arrive late; they must
    // not clear the newer payload.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
        attemptId: 1,
      });
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, {
        attemptId: 1,
      });
    });

    mockShouldRenderPageEveryChildren = false;
    view.rerender(<GlobalWalletConnectModalContainer />);

    mockShouldRenderPageEveryChildren = true;
    view.rerender(<GlobalWalletConnectModalContainer />);

    // The newer payload survived and is replayed on remount.
    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(3);
    });

    // The matching terminal event clears it even without a fresh open:true.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
        attemptId: 2,
      });
    });

    mockShouldRenderPageEveryChildren = false;
    view.rerender(<GlobalWalletConnectModalContainer />);

    mockShouldRenderPageEveryChildren = true;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(3);

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
