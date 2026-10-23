/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import type { IDialogInstance, IDialogShowProps } from '@onekeyhq/components';

import {
  ReversePositionContent,
  showReversePositionDialog,
} from './ReversePositionModal';

const mockSnapshot = {
  coin: 'ETH',
  accountAddress: '0x1111',
  positionSize: '1',
};
let mockAccount = { accountAddress: mockSnapshot.accountAddress };
let mockPosition = {
  coin: 'ETH',
  szi: '1',
  leverage: { type: 'cross', value: 10 },
};
const mockAssetData = {
  coin: 'ETH',
  user: mockSnapshot.accountAddress,
  markPx: '2000',
  maxTradeSzs: ['5', '5'],
  leverage: { type: 'cross', value: 10 },
};
const mockTarget = {
  assetData: mockAssetData,
  symbolMeta: {
    coin: 'ETH',
    assetId: 1,
    isSpot: false,
    universe: { szDecimals: 3, maxLeverage: 20 },
  },
  price: '2000',
};
const mockPlaceOrder = jest.fn();
const mockCancelOrder = jest.fn();
const mockEnsureTrading = jest.fn();
const mockFetchAsset = jest.fn<Promise<typeof mockAssetData>, unknown[]>();
const mockToastError = jest.fn<void, unknown[]>();
const mockClose = jest.fn();
const mockDialogShow = jest.fn<
  Pick<IDialogInstance, 'close'>,
  [IDialogShowProps]
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Button: ({
      children,
      onPress,
      disabled,
      loading,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      loading?: boolean;
      testID?: string;
    }) => (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-busy={loading ?? false}
        data-testid={testID}
      >
        {children}
      </button>
    ),
    Dialog: { show: (props: IDialogShowProps) => mockDialogShow(props) },
    Divider: () => <hr />,
    SizableText: Stack,
    XStack: Stack,
    YStack: Stack,
    Toast: { error: (...args: unknown[]) => mockToastError(...args) },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getActiveAssetDataByCoin: (...args: unknown[]) => mockFetchAsset(...args),
      getSymbolMeta: async () => mockTarget.symbolMeta,
      getMarketOrderReferencePrice: async () => mockTarget.price,
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockTarget,
    isLoading: false,
    run: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { placeOrderByCoin: mockPlaceOrder, cancelOrder: mockCancelOrder },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [mockAccount],
}));
jest.mock('../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => mockEnsureTrading,
}));
jest.mock('../../hooks/usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [{ position: mockPosition }],
}));
jest.mock('../../hooks/usePerpsCrossAvailableAfterMaintenance', () => ({
  usePerpsCrossAvailableAfterMaintenance: () => undefined,
}));
jest.mock('../../PerpsAccountSelectorProviderMirror', () => ({
  PerpsAccountSelectorProviderMirror: ({
    children,
  }: {
    children?: ReactNode;
  }) => children,
}));
jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('../../utils/styleUtils', () => ({
  getTradingSideTextColor: () => '$text',
}));
jest.mock('../TradingGuardWrapper', () => ({
  TradingGuardWrapper: ({ children }: { children?: ReactNode }) => children,
}));

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('reverse position confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount = { accountAddress: mockSnapshot.accountAddress };
    mockPosition = {
      coin: 'ETH',
      szi: '1',
      leverage: { type: 'cross', value: 10 },
    };
    mockFetchAsset.mockResolvedValue(mockAssetData);
    mockPlaceOrder.mockResolvedValue({ status: 'ok' });
    mockEnsureTrading.mockResolvedValue(undefined);
    mockDialogShow.mockImplementation((props) => ({
      close: async () => {
        if (props.onBeforeClose && !(await props.onBeforeClose())) return;
        mockClose();
      },
    }));
  });
  it('submits one market order, never cancels orders, and prevents duplicate submission', async () => {
    const pending = deferred();
    mockPlaceOrder.mockReturnValueOnce(pending.promise);
    const view = render(
      <ReversePositionContent snapshot={mockSnapshot} onClose={mockClose} />,
    );
    const confirm = view.getByTestId('perp-reverse-position-confirm-button');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(mockPlaceOrder).toHaveBeenCalledTimes(1));
    expect(mockPlaceOrder).toHaveBeenCalledWith({
      coin: 'ETH',
      expectedAccountAddress: '0x1111',
      isBuy: false,
      size: '2',
      price: '2000',
      orderType: 'market',
      slippage: 0.08,
    });
    expect(mockCancelOrder).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  it('blocks dismissal throughout preparation and submission, then closes on success', async () => {
    const preparation = deferred();
    const submission = deferred();
    mockEnsureTrading.mockReturnValueOnce(preparation.promise);
    mockPlaceOrder.mockReturnValueOnce(submission.promise);
    const dialog = showReversePositionDialog(mockSnapshot, '反向开仓');
    const options = mockDialogShow.mock.calls[0][0];
    const view = render(<>{options.renderContent}</>);
    const confirm = view.getByTestId('perp-reverse-position-confirm-button');

    expect(options.onBeforeClose?.()).toBe(true);
    fireEvent.click(confirm);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(options.onBeforeClose?.()).toBe(false);
    await act(async () => {
      await dialog.close();
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockPlaceOrder).not.toHaveBeenCalled();

    await act(async () => {
      preparation.resolve();
      await preparation.promise;
    });
    await waitFor(() => expect(mockPlaceOrder).toHaveBeenCalledTimes(1));
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(options.onBeforeClose?.()).toBe(false);
    fireEvent.click(confirm);
    await act(async () => {
      await dialog.close();
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      submission.resolve();
      await submission.promise;
    });
    expect(options.onBeforeClose?.()).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
    // Closing starts before the exit animation unmounts the content.
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
  });
  it.each(['preparation', 'submission'])(
    'restores dismissal and clears loading after %s fails',
    async (phase) => {
      const error = new Error('Request failed');
      if (phase === 'preparation') mockFetchAsset.mockRejectedValueOnce(error);
      else mockPlaceOrder.mockRejectedValueOnce(error);
      const dialog = showReversePositionDialog(mockSnapshot, '反向开仓');
      const options = mockDialogShow.mock.calls[0][0];
      const view = render(<>{options.renderContent}</>);
      const confirm = view.getByTestId('perp-reverse-position-confirm-button');

      fireEvent.click(confirm);
      await waitFor(() =>
        expect(confirm.getAttribute('aria-busy')).toBe('false'),
      );
      expect(options.onBeforeClose?.()).toBe(true);
      expect((confirm as HTMLButtonElement).disabled).toBe(false);
      expect(mockClose).not.toHaveBeenCalled();
      await act(async () => {
        await dialog.close();
      });
      expect(mockClose).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['account', 'size', 'direction', 'closed'])(
    'stops after %s changes during enable trading',
    async (change) => {
      const pending = deferred();
      mockEnsureTrading.mockReturnValueOnce(pending.promise);
      const view = render(
        <ReversePositionContent snapshot={mockSnapshot} onClose={mockClose} />,
      );
      fireEvent.click(view.getByTestId('perp-reverse-position-confirm-button'));
      if (change === 'account') mockAccount = { accountAddress: '0x2222' };
      else {
        const sizes = { size: '2', direction: '-1', closed: '0' };
        mockPosition = {
          ...mockPosition,
          szi: sizes[change as keyof typeof sizes],
        };
      }
      view.rerender(
        <ReversePositionContent snapshot={mockSnapshot} onClose={mockClose} />,
      );
      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
      expect(mockPlaceOrder).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    },
  );
  it('does not submit if the confirmation is closed during preparation', async () => {
    const pending = deferred();
    mockEnsureTrading.mockReturnValueOnce(pending.promise);
    const view = render(
      <ReversePositionContent snapshot={mockSnapshot} onClose={mockClose} />,
    );
    fireEvent.click(view.getByTestId('perp-reverse-position-confirm-button'));
    view.unmount();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });
  it('keeps the confirmation open on exchange failure without a duplicate error toast', async () => {
    mockPlaceOrder.mockRejectedValueOnce(new Error('Exchange failure'));
    const view = render(
      <ReversePositionContent snapshot={mockSnapshot} onClose={mockClose} />,
    );
    fireEvent.click(view.getByTestId('perp-reverse-position-confirm-button'));
    await waitFor(() => expect(mockPlaceOrder).toHaveBeenCalledTimes(1));
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});
