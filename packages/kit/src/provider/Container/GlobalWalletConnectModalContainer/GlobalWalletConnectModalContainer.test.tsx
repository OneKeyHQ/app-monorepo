/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { trackWalletConnectProposal } from '../../../components/WalletConnect/walletConnectProposalVisibility';

import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';

let mockSplitViewType = 'unknown';
let mockIsNative = true;
const mockOverlayView = jest.fn(
  ({ children }: { children?: ReactNode; [key: string]: unknown }) => children,
);
const mockWalletConnectModal = jest.fn((_props: { suspended: boolean }) => (
  <div data-testid="wallet-picker" />
));
const mockOpenModal = jest.fn();
const mockCloseModal = jest.fn();

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
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('../../../components/WalletConnect/WalletConnectModal', () => ({
  __esModule: true,
  default: {
    useModal: (suspended: boolean) => ({
      modal: mockWalletConnectModal({ suspended }),
      openModal: mockOpenModal,
      closeModal: mockCloseModal,
    }),
  },
}));

describe('GlobalWalletConnectModalContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSplitViewType = 'unknown';
    mockIsNative = true;
  });

  it('hosts the native modal inside a fullscreen OverlayView only while a pairing payload is active', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    expect(mockOverlayView).not.toHaveBeenCalled();
    expect(mockWalletConnectModal).not.toHaveBeenCalled();

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:test-pairing-uri',
        attemptId: 11,
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);
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

    expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);

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
    expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it.each(['already open', 'arrives during approval'])(
    'restores the outgoing picker that was %s after approval exits',
    async (timing) => {
      render(<GlobalWalletConnectModalContainer />);
      const emitPicker = () => {
        appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
          uri: 'wc:queued-picker',
          attemptId: 21,
        });
      };
      let endProposal = () => {};
      if (timing === 'already open') {
        act(emitPicker);
        await waitFor(() =>
          expect(mockWalletConnectModal).toHaveBeenLastCalledWith({
            suspended: false,
          }),
        );
      }
      act(() => {
        endProposal = trackWalletConnectProposal();
        if (timing === 'arrives during approval') emitPicker();
      });
      await waitFor(() =>
        expect(mockWalletConnectModal).toHaveBeenLastCalledWith({
          suspended: true,
        }),
      );
      expect(mockOverlayView).toHaveBeenLastCalledWith(
        expect.objectContaining({ visible: false, keepContentMounted: true }),
      );
      const picker = screen.getByTestId('wallet-picker');

      act(endProposal);
      expect(mockWalletConnectModal).toHaveBeenLastCalledWith({
        suspended: false,
      });
      expect(mockOverlayView).toHaveBeenLastCalledWith(
        expect.objectContaining({ visible: true }),
      );
      expect(screen.getByTestId('wallet-picker')).toBe(picker);

      act(() => {
        appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, {
          attemptId: 21,
        });
      });
    },
  );

  it('does not restore a pairing that finished during the proposal', async () => {
    render(<GlobalWalletConnectModalContainer />);
    let endProposal = () => {};
    act(() => {
      endProposal = trackWalletConnectProposal();
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:finished-pairing',
        attemptId: 22,
      });
    });
    await waitFor(() =>
      expect(mockWalletConnectModal).toHaveBeenLastCalledWith({
        suspended: true,
      }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, {
        attemptId: 22,
      });
    });
    const renderCount = mockOverlayView.mock.calls.length;
    act(endProposal);

    expect(mockOverlayView).toHaveBeenCalledTimes(renderCount);
  });

  it('clears the pairing payload and unmounts the overlay on WalletConnectCloseModal', async () => {
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:cancelled-before-open',
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);
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
    expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);

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
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);
    });

    // A second pairing lands while the first modal is still open.
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:second-session',
        attemptId: 2,
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(2);
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

  it('renders directly without OverlayView on non-native platforms', async () => {
    mockIsNative = false;
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:web-session',
      });
    });

    await waitFor(() => {
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);
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
    expect(mockWalletConnectModal).not.toHaveBeenCalled();

    mockSplitViewType = 'sub';
    view.rerender(<GlobalWalletConnectModalContainer />);

    await waitFor(() => {
      expect(mockWalletConnectModal).toHaveBeenCalledTimes(1);
    });

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    });
    view.unmount();
  });
});
