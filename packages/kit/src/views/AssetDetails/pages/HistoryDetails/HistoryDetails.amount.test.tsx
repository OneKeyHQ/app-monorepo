/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { render, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EOnChainHistoryTransferType,
  type IAccountHistoryTx,
  type IOnChainHistoryTx,
  type IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import HistoryDetails from './HistoryDetails';

let mockHistory: IAccountHistoryTx;
let mockTxDetails: Partial<IOnChainHistoryTx> | undefined;

beforeEach(() => {
  mockTxDetails = undefined;
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      accountId: 'synthetic-account',
      networkId: mockHistory.decodedTx.networkId,
      historyTx: mockHistory,
    },
  }),
}));
jest.mock('@onekeyhq/components', () => {
  const container = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Badge: container,
    Button: container,
    Divider: () => null,
    Icon: () => null,
    IconButton: ({ title }: { title?: string }) => <button>{title}</button>,
    Page: Object.assign(container, { Header: () => null, Body: container }),
    SizableText: container,
    Spinner: () => null,
    Stack: container,
    XStack: container,
    YStack: container,
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Text: ({
        primary,
        secondary,
      }: {
        primary?: ReactNode;
        secondary?: ReactNode;
      }) => (
        <div>
          {primary}
          {secondary}
        </div>
      ),
    },
  ),
}));
jest.mock('@onekeyhq/kit/src/components/NumberSizeableTextWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => (
    <span data-testid="formatted-number">{children}</span>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/components/AddressInfo', () => ({
  AddressInfo: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TxHistoryListView/SpeedUpAction',
  () => ({ SpeedUpAction: () => null }),
);
jest.mock('@onekeyhq/kit/src/components/ZcashMemo', () => ({
  ZcashMemo: () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/useReplaceTx', () => ({
  useReplaceTx: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => ({
    account: { address: 'own' },
    network: {
      id: mockHistory.decodedTx.networkId,
      impl: mockHistory.decodedTx.networkId === 'zec--0' ? 'zec' : 'xmr',
      symbol: 'XMR',
      name: 'Monero',
    },
    vaultSettings: {
      localWallet: {
        publicAddressPattern:
          mockHistory.decodedTx.networkId === 'zec--0'
            ? '^t[13][1-9A-HJ-NP-Za-km-z]{33}$'
            : '(?!)',
        privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
        pools: [
          { id: 0, label: 'Transparent', kind: 'public', source: 'backend' },
          { id: 3, label: 'Orchard', kind: 'private', source: 'localScan' },
          { id: 4, label: 'Ironwood', kind: 'private', source: 'localScan' },
        ],
      },
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (_request: unknown, deps: unknown[]) => ({
    result:
      deps.length === 2 ? { symbol: 'XMR' } : { txDetails: mockTxDetails },
    isLoading: false,
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock(
  '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider',
  () => ({
    withBrowserProvider: (component: ComponentType) => component,
  }),
);
jest.mock('@onekeyhq/kit/src/views/Swap/utils/privateSendHistory', () => ({
  isPrivateSendHistoryTx: () => false,
  maybeOpenPrivateSendHistoryDetail: async () => false,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheNamespaces: { historyTxDetail: 'detail' },
  swrCacheUtils: { removeByPrefix: jest.fn(), flushNow: jest.fn() },
  swrKeys: { historyTxDetail: () => 'test-detail' },
}));
jest.mock('@onekeyhq/shared/src/utils/historyUtils', () => ({
  getHistoryTxDetailInfo: () => ({}),
}));
jest.mock('../../utils', () => ({ getHistoryTxMeta: () => undefined }));
jest.mock('./components/TxKYTRiskCheck', () => ({
  TxKYTRiskCheck: () => null,
}));

function history(
  networkId: string,
  amount: string,
  unknown: boolean,
): IAccountHistoryTx {
  return {
    id: 'synthetic-history',
    decodedTx: {
      txid: 'synthetic-tx',
      owner: 'own',
      signer: 'own',
      nonce: 0,
      status: EDecodedTxStatus.Confirmed,
      networkId,
      accountId: 'synthetic-account',
      extraInfo: null,
      nativeAmount: amount,
      nativeAmountIsUnknown: unknown,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: 'own',
            to: 'recipient',
            receives: [],
            sends: [
              {
                from: 'own',
                to: 'recipient',
                amount,
                tokenIdOnNetwork: '',
                icon: '',
                name: 'Native',
                symbol: 'XMR',
                isNative: true,
                isNFT: false,
                price: '10',
              },
            ],
          },
        },
      ],
    },
  };
}

it.each([
  ['xmr--0', '1.00003'],
  ['zec--0', '0'],
])(
  'does not present the unknown %s payment or its fiat value as an exact amount',
  (networkId, amount) => {
    mockHistory = history(networkId, amount, true);
    const result = render(<HistoryDetails />);
    const assets = within(
      result.getByTestId('history-details-what-assets-change'),
    );
    expect(assets.getByText(ETranslations.global_not_available)).toBeTruthy();
    expect(assets.queryAllByTestId('formatted-number')).toHaveLength(0);
  },
);

it('continues to show an exact known payment and its fiat value', () => {
  mockHistory = history('xmr--0', '1', false);
  const result = render(<HistoryDetails />);
  const assets = within(
    result.getByTestId('history-details-what-assets-change'),
  );
  expect(assets.getByText('-1')).toBeTruthy();
  expect(assets.getByText('10')).toBeTruthy();
});

it('keeps unrelated token amounts visible when only the native payment is unknown', () => {
  mockHistory = history('xmr--0', '1.00003', true);
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  transfer.sends.push({
    ...transfer.sends[0],
    tokenIdOnNetwork: 'token',
    symbol: 'TOKEN',
    amount: '7',
    isNative: false,
  });
  const result = render(<HistoryDetails />);
  const assets = within(
    result.getByTestId('history-details-what-assets-change'),
  );
  expect(assets.getByText(ETranslations.global_not_available)).toBeTruthy();
  expect(assets.getByText('-7')).toBeTruthy();
});

function setZcashFlow(from: string, to: string) {
  mockHistory = history('zec--0', '1', false);
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  transfer.from = from;
  transfer.to = to;
  transfer.sends[0].from = from;
  transfer.sends[0].to = to;
}

function poolOutput(
  label: string,
  overrides: Partial<IOnChainHistoryTxTransfer> = {},
): IOnChainHistoryTxTransfer {
  return {
    type: EOnChainHistoryTransferType.Shielded,
    from: '',
    to: '',
    address: '',
    amount: '1',
    token: '',
    key: '',
    label,
    isOwn: false,
    ...overrides,
  };
}

it('names the known source and destination pools without treating change as the destination', () => {
  setZcashFlow('Orchard pool', 'Shielded');
  mockTxDetails = {
    sends: [poolOutput('Orchard pool', { isOwn: true })],
    receives: [
      poolOutput('Ironwood pool'),
      poolOutput('Orchard pool', { isOwn: true, isChange: true }),
    ],
  };
  const result = render(<HistoryDetails />);
  const from = within(result.getByTestId('history-details-from-pool'));
  const to = within(result.getByTestId('history-details-to-pool'));
  expect(from.getByText('Orchard pool')).toBeTruthy();
  expect(to.getByText('Ironwood pool')).toBeTruthy();
  expect(to.queryByText('Orchard pool')).toBeNull();
  expect(from.queryByRole('button')).toBeNull();
  expect(to.queryByRole('button')).toBeNull();
});

it('retains the known recipient address alongside the destination pool', () => {
  const recipient = `u1${'a'.repeat(90)}`;
  setZcashFlow('Orchard pool', recipient);
  mockTxDetails = {
    receives: [
      poolOutput('Ironwood pool', { address: recipient, to: recipient }),
    ],
  };
  const result = render(<HistoryDetails />);
  expect(result.getByText(recipient)).toBeTruthy();
  expect(
    within(result.getByTestId('history-details-to-pool')).getByText(
      'Ironwood pool',
    ),
  ).toBeTruthy();
});

it.each([
  ['Orchard pool', 'Ironwood pool'],
  [`t1${'A'.repeat(33)}`, 'Ironwood pool'],
  ['Ironwood pool', `t3${'B'.repeat(33)}`],
  ['Ironwood pool', 'Ironwood pool'],
])(
  'shows both internal endpoints %s -> %s before output details arrive',
  (from, to) => {
    setZcashFlow(from, to);
    const result = render(<HistoryDetails />);
    expect(result.getAllByText(from)).toHaveLength(from === to ? 2 : 1);
    expect(result.getAllByText(to)).toHaveLength(from === to ? 2 : 1);
  },
);

it('shows the incoming pool while keeping an unavailable shielded sender unknown', () => {
  setZcashFlow('Shielded', 'Ironwood pool');
  mockHistory.decodedTx.signer = '';
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  transfer.receives = transfer.sends;
  transfer.sends = [];
  mockTxDetails = {
    receives: [poolOutput('Ironwood pool', { isOwn: true })],
  };
  const result = render(<HistoryDetails />);
  expect(
    result.getByText(ETranslations.privacy_history_sender_unknown__desc),
  ).toBeTruthy();
  expect(result.queryByTestId('history-details-from-pool')).toBeNull();
  expect(
    within(result.getByTestId('history-details-to-pool')).getByText(
      'Ironwood pool',
    ),
  ).toBeTruthy();
});

it('does not infer a destination pool from change alone', () => {
  setZcashFlow('Orchard pool', 'Shielded');
  mockTxDetails = {
    receives: [poolOutput('Orchard pool', { isOwn: true, isChange: true })],
  };
  const result = render(<HistoryDetails />);
  expect(result.queryByTestId('history-details-to-pool')).toBeNull();
});
