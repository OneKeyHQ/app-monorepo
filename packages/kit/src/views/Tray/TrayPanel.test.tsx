/**
 * @jest-environment jsdom
 */

import * as React from 'react';

import { act, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type IPendingTx,
  type ITrayData,
  TRAY_IPC,
} from '@onekeyhq/shared/src/types/desktop/tray';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { TrayPanel } from './TrayPanel';

/*
yarn jest packages/kit/src/views/Tray/TrayPanel.test.tsx
*/

jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Text = ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  );
  return {
    Icon: () => null,
    Image: () => null,
    ScrollView: Box,
    SizableText: Text,
    Stack: Box,
    XStack: Box,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/NumberSizeableTextWrapper', () => ({
  __esModule: true,
  default: ({
    children,
    formatterOptions,
  }: {
    children?: React.ReactNode;
    formatterOptions?: { tokenSymbol?: string };
  }) => (
    <span>
      {children} {formatterOptions?.tokenSymbol}
    </span>
  ),
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: () => '11/05 10:00' }),
}));

jest.mock('../../components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));

jest.mock('./components/WatchlistTickers', () => ({
  WatchlistTickers: () => <div data-testid="watchlist">$62,743.00</div>,
}));

// `useIntl` is mocked to echo the message id.
const UNLIMITED_LABEL =
  ETranslations.swap_page_provider_approve_amount_un_limit;

type ITrayUpdateListener = (data: ITrayData) => void;
type IDesktopApiHost = { desktopApi?: unknown };

function buildHistoryTx(decodedTx: Record<string, unknown>) {
  return {
    id: 'history-id',
    decodedTx: { createdAt: 1_762_300_000_000, ...decodedTx },
  } as unknown as IPendingTx['historyTx'];
}

const sendTx: IPendingTx = {
  id: 'tx-send',
  type: 'send',
  to: '0xrecipient',
  amount: '12.5 USDC',
  historyTx: buildHistoryTx({
    actions: [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: '0xsender',
          to: '0xrecipient',
          sends: [
            {
              from: '0xsender',
              to: '0xrecipient',
              amount: '12.5',
              symbol: 'USDC',
              tokenIdOnNetwork: '0xusdc',
            },
          ],
          receives: [],
        },
      },
    ],
  }),
};

const multiAssetSendTx: IPendingTx = {
  id: 'tx-multi',
  type: 'send',
  to: '0xrecipient',
  amount: '3 DAI',
  historyTx: buildHistoryTx({
    actions: [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: '0xsender',
          to: '0xrecipient',
          sends: [
            {
              from: '0xsender',
              to: '0xrecipient',
              amount: '3',
              symbol: 'DAI',
              tokenIdOnNetwork: '0xdai',
            },
            {
              from: '0xsender',
              to: '0xrecipient',
              amount: '7',
              symbol: 'WBTC',
              tokenIdOnNetwork: '0xwbtc',
            },
          ],
          receives: [],
        },
      },
    ],
  }),
};

const unlimitedApproveTx: IPendingTx = {
  id: 'tx-approve',
  type: 'approve',
  to: '0xspender',
  amount: '— USDT',
  historyTx: buildHistoryTx({
    actions: [
      {
        type: EDecodedTxActionType.TOKEN_APPROVE,
        tokenApprove: {
          amount:
            '115792089237316195423570985008687907853269984665640564039457',
          symbol: 'USDT',
          name: 'Tether USD',
          spender: '0xspender',
          isInfiniteAmount: true,
        },
      },
    ],
  }),
};

// No decoded history entry: the row falls back to the pre-formatted amount.
const fallbackAmountTx: IPendingTx = {
  id: 'tx-fallback',
  type: 'send',
  to: '0xrecipient',
  amount: '0.25 ETH',
};

// Contract call without a transfer: the provider sends the "no amount" dash.
const noAmountTx: IPendingTx = {
  id: 'tx-contract',
  type: 'contract',
  to: '0xcontract',
  amount: '—',
};

function buildTrayData(overrides: Partial<ITrayData> = {}): ITrayData {
  return {
    locale: 'en-US',
    accountId: 'account-1',
    wallet: { name: 'Product', emoji: '', avatarImg: '' },
    account: { name: 'Account #1' },
    totalBalance: { amount: '40.88', currency: 'usd', symbol: '$' },
    watchlist: [],
    pendingTxs: [
      sendTx,
      multiAssetSendTx,
      unlimitedApproveTx,
      fallbackAmountTx,
      noAmountTx,
    ],
    ...overrides,
  };
}

describe('TrayPanel hide value (OK-56225)', () => {
  let pushTrayUpdate: ITrayUpdateListener | undefined;

  beforeEach(() => {
    pushTrayUpdate = undefined;
    (globalThis as unknown as IDesktopApiHost).desktopApi = {
      addIpcEventListener: (event: string, listener: ITrayUpdateListener) => {
        if (event === TRAY_IPC.UPDATE) pushTrayUpdate = listener;
        return () => {};
      },
      sendTrayReady: jest.fn(),
      sendTrayAction: jest.fn(),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as IDesktopApiHost).desktopApi;
  });

  function renderWithTrayData(data: ITrayData) {
    const view = render(<TrayPanel />);
    act(() => {
      pushTrayUpdate?.(data);
    });
    return view;
  }

  test('shows the balance and pending amounts while values are visible', () => {
    const { container } = renderWithTrayData(buildTrayData());
    const text = container.textContent ?? '';

    expect(text).toContain('$40.88');
    expect(text).toContain('-12.5 USDC');
    expect(text).toContain(`-${ETranslations.count_assets}`);
    expect(text).toContain(`${UNLIMITED_LABEL} USDT`);
    expect(text).toContain('0.25 ETH');
    expect(text).not.toContain('****');
  });

  test('masks the total balance when the client hides values', () => {
    const { container } = renderWithTrayData(
      buildTrayData({ hideValue: true }),
    );
    const text = container.textContent ?? '';

    expect(text).toContain('****');
    expect(text).not.toContain('40.88');
    // Wallet identity is not a value and stays readable.
    expect(text).toContain('Product');
    expect(text).toContain('Account #1');
  });

  test('masks pending transaction amounts when the client hides values', () => {
    const { container } = renderWithTrayData(
      buildTrayData({ hideValue: true }),
    );
    const text = container.textContent ?? '';

    expect(text).toContain('**** USDC');
    expect(text).not.toContain('12.5');
    // Multi-asset summary has no single symbol to keep.
    expect(text).not.toContain(ETranslations.count_assets);
    expect(text).toContain('**** USDT');
    expect(text).not.toContain(UNLIMITED_LABEL);
    expect(text).not.toContain('0.25 ETH');
    // Labels that are not amounts stay readable.
    expect(text).toContain('Tether USD');
    expect(text).toContain('—');
  });

  test('keeps market quotes visible when the client hides values', () => {
    const { getByTestId } = renderWithTrayData(
      buildTrayData({ hideValue: true }),
    );

    expect(getByTestId('watchlist').textContent).toBe('$62,743.00');
  });

  test('follows a live toggle pushed by the main window', () => {
    const { container } = renderWithTrayData(buildTrayData());
    expect(container.textContent).toContain('$40.88');

    act(() => {
      pushTrayUpdate?.(buildTrayData({ hideValue: true }));
    });
    expect(container.textContent).not.toContain('40.88');

    act(() => {
      pushTrayUpdate?.(buildTrayData({ hideValue: false }));
    });
    expect(container.textContent).toContain('$40.88');
  });
});
