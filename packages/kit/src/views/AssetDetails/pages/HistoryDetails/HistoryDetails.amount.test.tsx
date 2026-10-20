/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { render, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  buildLocalWalletHistoryAddressGate,
  gateLocalWalletHistoryDetail,
  gateLocalWalletHistoryTx,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
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
// What Receive displays; the background gate checks rows against it.
let mockAccountAddresses:
  | { publicAddress?: string; privateAddress?: string }
  | undefined;

function mockGate() {
  const isZcash = mockHistory.decodedTx.networkId === 'zec--0';
  return buildLocalWalletHistoryAddressGate({
    localWallet: {
      pools: [{ id: 0, kind: 'public' }],
      publicAddressPattern: isZcash
        ? '^t[13][1-9A-HJ-NP-Za-km-z]{33}$'
        : '(?!)',
      addressForms: isZcash ? { publicLabel: 'transparent' } : undefined,
    },
    addresses: mockAccountAddresses,
  });
}

// Rows and details reach the page after the background gate.
function mockGatedHistory() {
  return mockHistory.decodedTx.networkId.startsWith('btc')
    ? mockHistory
    : gateLocalWalletHistoryTx(mockGate(), mockHistory);
}

function mockGatedDetails() {
  return mockTxDetails && !mockHistory.decodedTx.networkId.startsWith('btc')
    ? gateLocalWalletHistoryDetail(
        mockGate(),
        mockTxDetails as IOnChainHistoryTx,
      )
    : mockTxDetails;
}

beforeEach(() => {
  mockTxDetails = undefined;
  mockAccountAddresses = undefined;
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id, defaultMessage }: { id: string; defaultMessage?: string },
      values?: Record<string, string>,
    ) =>
      defaultMessage
        ? defaultMessage.replace(/\{(\w+)\}/g, (_, key: string) =>
            String(values?.[key]),
          )
        : id,
  }),
}));
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      accountId: 'synthetic-account',
      networkId: mockHistory.decodedTx.networkId,
      historyTx: mockGatedHistory(),
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
  ZcashMemo: ({ text }: { text?: string }) => (
    <div data-testid="history-details-memo">{text}</div>
  ),
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
    vaultSettings: mockHistory.decodedTx.networkId.startsWith('btc')
      ? { isUtxo: true }
      : {
          localWallet: {
            publicAddressPattern:
              mockHistory.decodedTx.networkId === 'zec--0'
                ? '^t[13][1-9A-HJ-NP-Za-km-z]{33}$'
                : '(?!)',
            privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
            pools: [
              {
                id: 0,
                label: 'Transparent',
                kind: 'public',
                source: 'backend',
              },
              {
                id: 3,
                label: 'Orchard',
                kind: 'private',
                source: 'localScan',
                receivesFunds: false,
              },
              {
                id: 4,
                label: 'Ironwood',
                kind: 'private',
                source: 'localScan',
              },
            ],
            historyOnlyPools: [{ id: 2, label: 'Sapling' }],
          },
        },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (_request: unknown, deps: unknown[]) => ({
    result:
      deps.length === 2 ? { symbol: 'XMR' } : { txDetails: mockGatedDetails() },
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

it('shows an exactly known recipient instead of its pool', () => {
  const recipient = `u1${'a'.repeat(90)}`;
  setZcashFlow('Orchard pool', recipient);
  mockTxDetails = {
    receives: [
      poolOutput('Ironwood pool', { address: recipient, to: recipient }),
    ],
  };
  const result = render(<HistoryDetails />);
  expect(
    within(result.getByTestId('history-details-to-recipient')).getByText(
      recipient,
    ),
  ).toBeTruthy();
  expect(result.queryByTestId('history-details-to-pool')).toBeNull();
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

it('names the pool of a hidden sender in a row written by an older build', () => {
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
  const from = within(result.getByTestId('history-details-from-pool'));
  expect(from.getByText('Shielded')).toBeTruthy();
  expect(
    from.getByText(ETranslations.privacy_history_sender_unknown__desc),
  ).toBeTruthy();
  // Explained under the pool name rather than in a separate "Unknown" row.
  expect(
    result.getAllByText(ETranslations.privacy_history_sender_unknown__desc),
  ).toHaveLength(1);
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
  const to = within(result.getByTestId('history-details-to-pool'));
  expect(to.getByText('Shielded')).toBeTruthy();
  expect(to.queryByText('Orchard pool')).toBeNull();
});

type IEndpointFixture = {
  address?: string;
  poolId?: number;
  shielded?: boolean;
  own?: boolean;
};

const OWN_UA = `u1${'q'.repeat(90)}`;
const OWN_T = `t1${'A'.repeat(33)}`;

function setZcashEndpoints(from: IEndpointFixture, to: IEndpointFixture) {
  setZcashFlow(from.address ?? '', to.address ?? '');
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  const marker = (side: IEndpointFixture) =>
    side.shielded || side.poolId !== undefined || side.own
      ? { poolId: side.poolId, ...(side.own ? { isOwn: true } : {}) }
      : undefined;
  transfer.shieldedFrom = marker(from);
  transfer.shieldedTo = marker(to);
  transfer.sends[0].shieldedFrom = marker(from);
  transfer.sends[0].shieldedTo = marker(to);
}

function receiveRow(from: IEndpointFixture, to: IEndpointFixture) {
  setZcashEndpoints(from, to);
  mockHistory.decodedTx.signer = '';
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  transfer.receives = transfer.sends;
  transfer.sends = [];
}

function shieldedOutput(
  poolId: number | undefined,
  overrides: Partial<IOnChainHistoryTxTransfer> = {},
): IOnChainHistoryTxTransfer {
  return poolOutput('', { poolId, ...overrides });
}

const DIVERSIFIED = `u1${'d'.repeat(90)}`;

it.each([
  [OWN_UA, true],
  [DIVERSIFIED, false],
  [null, false],
])(
  'shows our receiving side (note reached %s) as the displayed u1 only when equal',
  (receivedAt, shown) => {
    mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
    receiveRow({ poolId: 4 }, { poolId: 4, own: true });
    mockTxDetails = {
      receives: [
        shieldedOutput(4, {
          isOwn: true,
          address: receivedAt ?? '',
          to: receivedAt ?? '',
        }),
      ],
    };
    const result = render(<HistoryDetails />);
    const from = within(result.getByTestId('history-details-from-pool'));
    expect(from.getByText('Ironwood pool')).toBeTruthy();
    expect(from.queryByRole('button')).toBeNull();
    expect(result.queryByText(DIVERSIFIED)).toBeNull();
    if (shown) {
      const to = within(result.getByTestId('history-details-to-own'));
      expect(to.getByText(OWN_UA)).toBeTruthy();
      expect(to.getByRole('button')).toBeTruthy();
      expect(result.queryByTestId('history-details-to-pool')).toBeNull();
    } else {
      const to = within(result.getByTestId('history-details-to-pool'));
      expect(to.getByText('Ironwood pool')).toBeTruthy();
      expect(to.queryByRole('button')).toBeNull();
      expect(result.queryByText(OWN_UA)).toBeNull();
    }
  },
);

it('shows the pool name for our side while no private address is displayed', () => {
  mockAccountAddresses = { publicAddress: OWN_T };
  receiveRow({ poolId: 4 }, { poolId: 4, own: true });
  mockTxDetails = {
    receives: [shieldedOutput(4, { isOwn: true, address: OWN_UA, to: OWN_UA })],
  };
  const result = render(<HistoryDetails />);
  expect(
    within(result.getByTestId('history-details-to-pool')).getByText(
      'Ironwood pool',
    ),
  ).toBeTruthy();
  expect(result.queryByTestId('history-details-to-own')).toBeNull();
});

it('never shows a self-payment or change address that is not the displayed u1', () => {
  mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
  // Our send recorded our own diversified address as its recipient.
  setZcashEndpoints({ poolId: 4, own: true }, { address: DIVERSIFIED });
  mockTxDetails = {
    sends: [shieldedOutput(4, { isOwn: true })],
    receives: [
      shieldedOutput(4, {
        isOwn: true,
        address: DIVERSIFIED,
        to: DIVERSIFIED,
      }),
      shieldedOutput(4, {
        isOwn: true,
        isChange: true,
        address: `u1${'c'.repeat(90)}`,
        to: `u1${'c'.repeat(90)}`,
      }),
    ],
  };
  const result = render(<HistoryDetails />);
  expect(result.queryByText(DIVERSIFIED)).toBeNull();
  expect(result.queryByText(`u1${'c'.repeat(90)}`)).toBeNull();
  const to = within(result.getByTestId('history-details-to-pool'));
  expect(to.getByText('Ironwood pool')).toBeTruthy();
  expect(to.queryByRole('button')).toBeNull();
  const from = within(result.getByTestId('history-details-from-pool'));
  expect(from.getByText('Ironwood pool')).toBeTruthy();
  expect(from.queryByRole('button')).toBeNull();
  expect(result.queryByText(OWN_UA)).toBeNull();
});

it.each([
  [OWN_T, true],
  [`t1${'C'.repeat(33)}`, false],
  [undefined, false],
])(
  'shows our transparent address only when the displayed one is %s',
  (displayed, shown) => {
    mockAccountAddresses = displayed
      ? { publicAddress: displayed, privateAddress: OWN_UA }
      : undefined;
    setZcashEndpoints({ address: OWN_T }, { poolId: 4, own: true });
    mockHistory.decodedTx.owner = OWN_T;
    mockHistory.decodedTx.signer = OWN_T;
    const result = render(<HistoryDetails />);
    if (shown) {
      expect(result.getAllByText(OWN_T)).toHaveLength(1);
    } else {
      expect(result.queryByText(OWN_T)).toBeNull();
      const from = within(result.getByTestId('history-details-from-pool'));
      expect(from.getByText('Transparent pool')).toBeTruthy();
      expect(from.queryByRole('button')).toBeNull();
    }
  },
);

it('names our sending side by pool and shows the recipient we recorded', () => {
  mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
  const recipient = `u1${'z'.repeat(90)}`;
  setZcashEndpoints({ poolId: 4, own: true }, { address: recipient });
  mockTxDetails = {
    sends: [shieldedOutput(4, { isOwn: true })],
    receives: [
      shieldedOutput(4, { address: recipient, to: recipient }),
      shieldedOutput(4, { isOwn: true, isChange: true }),
    ],
  };
  const result = render(<HistoryDetails />);
  const from = within(result.getByTestId('history-details-from-pool'));
  expect(from.getByText('Ironwood pool')).toBeTruthy();
  expect(from.queryByRole('button')).toBeNull();
  expect(result.queryByText(OWN_UA)).toBeNull();
  expect(
    within(result.getByTestId('history-details-to-recipient')).getByText(
      recipient,
    ),
  ).toBeTruthy();
  expect(result.queryByTestId('history-details-to-pool')).toBeNull();
});

it('names the recipient pool when the recipient is unknown', () => {
  mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
  setZcashEndpoints({ poolId: 4, own: true }, { shielded: true });
  mockTxDetails = { receives: [shieldedOutput(4)] };
  const result = render(<HistoryDetails />);
  const to = within(result.getByTestId('history-details-to-pool'));
  expect(to.getByText('Ironwood pool')).toBeTruthy();
  expect(to.queryByText('Shielded')).toBeNull();
});

it.each([
  // Which own address a note reached is unknown here: the pool is named.
  [{ address: OWN_T }, { poolId: 4, own: true }, [OWN_T, 'Ironwood pool']],
  [{ poolId: 4, own: true }, { address: OWN_T }, ['Ironwood pool', OWN_T]],
  // A legacy pool shows no receive address, so it keeps its name.
  [
    { poolId: 3, own: true },
    { poolId: 4, own: true },
    ['Orchard pool', 'Ironwood pool'],
  ],
])('shows both sides of an internal move %j -> %j', (from, to, texts) => {
  mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
  setZcashEndpoints(from, to);
  mockHistory.decodedTx.owner = OWN_T;
  mockHistory.decodedTx.signer = OWN_T;
  const result = render(<HistoryDetails />);
  for (const text of texts) {
    expect(result.getAllByText(text)).toHaveLength(1);
  }
});

it('names a Sapling output although Sapling has no tab', () => {
  setZcashEndpoints({ poolId: 4, own: true }, { shielded: true });
  mockTxDetails = { receives: [shieldedOutput(2)] };
  const result = render(<HistoryDetails />);
  expect(
    within(result.getByTestId('history-details-to-pool')).getByText(
      'Sapling pool',
    ),
  ).toBeTruthy();
});

it('names our transparent change address by pool and shows the displayed t1', () => {
  const change = `t1${'H'.repeat(33)}`;
  const external = `t1${'E'.repeat(33)}`;
  mockAccountAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
  setZcashFlow(OWN_T, external);
  mockHistory.decodedTx.owner = OWN_T;
  mockHistory.decodedTx.signer = OWN_T;
  const transfer = mockHistory.decodedTx.actions[0].assetTransfer;
  if (!transfer) throw new OneKeyLocalError('missing transfer fixture');
  // An indexer row for an xpub account: the change goes to m/…/1/0.
  transfer.sends = [{ ...transfer.sends[0], from: OWN_T, to: '', isOwn: true }];
  transfer.receives = [
    { ...transfer.sends[0], from: '', to: external, isOwn: false },
    { ...transfer.sends[0], from: '', to: change, isOwn: true },
  ];
  const result = render(<HistoryDetails />);
  expect(result.queryByText(change)).toBeNull();
  const pool = within(result.getByTestId('history-details-to-pool'));
  expect(pool.getByText('Transparent pool')).toBeTruthy();
  expect(pool.queryByRole('button')).toBeNull();
  expect(result.getAllByText(OWN_T)).toHaveLength(1);
  expect(result.getAllByText(external)).toHaveLength(1);
});

it.each([
  ['zec--0', true],
  ['btc--0', false],
])(
  'renders a decrypted memo only for local-wallet history (%s)',
  (networkId, shown) => {
    mockHistory = history(networkId, '1', false);
    mockTxDetails = { memo: 'memo text' };
    const result = render(<HistoryDetails />);
    expect(!!result.queryByTestId('history-details-memo')).toBe(shown);
  },
);
