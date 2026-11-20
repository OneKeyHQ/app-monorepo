/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';

let mockSplitViewType = 'unknown';
let mockIsNativeIOS = true;
const mockOverlayView = jest.fn(
  ({ children }: { children?: ReactNode; [key: string]: unknown }) => children,
);
const mockWalletConnectModalContainer = jest.fn(() => null);

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: (props: { children?: ReactNode; [key: string]: unknown }) =>
    mockOverlayView(props),
}));

jest.mock('@onekeyhq/components', () => ({
  ESplitViewType: {
    MAIN: 'main',
    SUB: 'sub',
    UNKNOWN: 'unknown',
  },
  useSplitViewType: () => mockSplitViewType,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOS() {
      return mockIsNativeIOS;
    },
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
    mockSplitViewType = 'unknown';
    mockIsNativeIOS = true;
  });

  it('hosts the iOS modal inside a fullscreen OverlayView only while a pairing payload is active', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    expect(mockOverlayView).not.toHaveBeenCalled();
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
    expect(mockOverlayView).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: true,
        level: 'modal',
        presentation: 'fullscreen',
        blocking: false,
        backdrop: false,
        dismissOnBackPress: false,
        testID: 'wallet-connect-modal-overlay',
      }),
    );

    // The native modal's initial open:false emit carries no attemptId and must
    // not tear down the active overlay.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
      });
    });

    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);

    // Matching close clears the payload and unmounts the OverlayView.
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

    const overlayCallsBeforeRerender = mockOverlayView.mock.calls.length;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockOverlayView).toHaveBeenCalledTimes(overlayCallsBeforeRerender);
    expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('clears the pairing payload and unmounts the overlay on WalletConnectCloseModal', async () => {
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

    const overlayCallsAfterClose = mockOverlayView.mock.calls.length;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockOverlayView).toHaveBeenCalledTimes(overlayCallsAfterClose);
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

    const overlayCallsBeforeRerender = mockOverlayView.mock.calls.length;
    view.rerender(<GlobalWalletConnectModalContainer />);

    // The newer payload survived and keeps the overlay mounted.
    expect(mockOverlayView.mock.calls.length).toBeGreaterThan(
      overlayCallsBeforeRerender,
    );

    // The matching terminal event clears it even without a fresh open:true.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
        attemptId: 2,
      });
    });

    const overlayCallsAfterClear = mockOverlayView.mock.calls.length;
    view.rerender(<GlobalWalletConnectModalContainer />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockOverlayView).toHaveBeenCalledTimes(overlayCallsAfterClear);

    view.unmount();
  });

  it('renders directly without OverlayView on non-iOS platforms', async () => {
    mockIsNativeIOS = false;
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:android-session',
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModalContainer).toHaveBeenCalledTimes(1);
    });
    expect(mockOverlayView).not.toHaveBeenCalled();

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    });
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
