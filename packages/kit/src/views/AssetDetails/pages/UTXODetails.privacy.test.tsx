/** @jest-environment jsdom */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { render, waitFor } from '@testing-library/react';

import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTx,
  type IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

import UTXODetails from './UTXODetails';

const OWN_T = `t1${'A'.repeat(33)}`;
const OWN_UA = `u1${'q'.repeat(90)}`;
const DIVERSIFIED = `u1${'d'.repeat(90)}`;
const RECIPIENT = `u1${'z'.repeat(90)}`;

let mockNetworkId = 'zec--0';
let mockDetails: Partial<IOnChainHistoryTx> = {};
let mockAddresses: { publicAddress?: string; privateAddress?: string } = {};

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
    params: { networkId: mockNetworkId, accountId: 'acc', txId: 'tx' },
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
    Badge: Object.assign(container, { Text: container }),
    Heading: container,
    Icon: () => null,
    Page: Object.assign(container, { Header: () => null, Body: container }),
    SizableText: container,
    Spinner: () => <div data-testid="loading" />,
    Stack: container,
    XStack: container,
    YStack: container,
  };
});
jest.mock('@onekeyhq/kit/src/components/ZcashMemo', () => ({
  ZcashMemo: () => null,
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchHistoryTxDetails: async () => ({ data: mockDetails }),
    },
  },
}));
jest.mock('../../../hooks/useLocalWalletAccountAddresses', () => ({
  useLocalWalletAccountAddresses: () => mockAddresses,
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    fn: () => Promise<unknown>,
    _deps: unknown[],
    options?: { initResult?: unknown },
  ) => {
    const [state, setState] = useState<{
      result: unknown;
      isLoading: boolean;
    }>({ result: options?.initResult, isLoading: true });
    useEffect(() => {
      void fn().then((result) => setState({ result, isLoading: false }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return state;
  },
}));
jest.mock('../../../hooks/useAccountData', () => ({
  useAccountData: () => ({
    account: { address: OWN_T },
    network: { symbol: 'ZEC' },
    vaultSettings: mockNetworkId.startsWith('zec')
      ? {
          isUtxo: true,
          localWallet: {
            publicAddressPattern: '^t[13][1-9A-HJ-NP-Za-km-z]{33}$',
            privateAddressPattern: '^u1[02-9ac-hj-np-z]+$',
            pools: [
              { id: 0, label: 'Transparent', kind: 'public' },
              { id: 4, label: 'Ironwood', kind: 'private' },
            ],
            historyOnlyPools: [{ id: 2, label: 'Sapling' }],
          },
        }
      : { isUtxo: true },
  }),
}));

const entry = (
  overrides: Partial<IOnChainHistoryTxTransfer>,
): IOnChainHistoryTxTransfer => ({
  type: EOnChainHistoryTransferType.Shielded,
  from: '',
  to: '',
  address: '',
  token: '',
  key: '',
  amount: '1',
  label: '',
  ...overrides,
});

async function renderPage() {
  const result = render(<UTXODetails />);
  await waitFor(() => expect(result.queryByTestId('loading')).toBeNull());
  return result;
}

beforeEach(() => {
  mockNetworkId = 'zec--0';
  mockAddresses = { publicAddress: OWN_T, privateAddress: OWN_UA };
});

it('names own notes by pool unless the note names the displayed address', async () => {
  mockDetails = {
    inputOutputSource: 'account',
    sends: [entry({ poolId: 4, isOwn: true })],
    receives: [
      entry({ poolId: 4, isOwn: false, address: RECIPIENT, to: RECIPIENT }),
      entry({
        poolId: 4,
        isOwn: true,
        isChange: true,
        address: DIVERSIFIED,
        to: DIVERSIFIED,
      }),
      entry({ poolId: 4, isOwn: true, address: OWN_UA, to: OWN_UA }),
      entry({ poolId: 2, isOwn: true }),
    ],
  };
  const result = await renderPage();
  const text = result.container.textContent ?? '';
  expect(text).not.toContain(DIVERSIFIED);
  expect(text).toContain(RECIPIENT);
  expect(text).toContain('Sapling pool');
  // The spent note names no address, so it keeps its pool name; only the
  // output naming the displayed UA shows it.
  expect(result.getAllByText(OWN_UA)).toHaveLength(1);
  expect(result.getAllByText('Ironwood pool')).toHaveLength(2);
});

it.each([
  [OWN_T, OWN_T],
  [`t1${'C'.repeat(33)}`, 'Transparent pool'],
])(
  'shows our transparent input only when the displayed one is %s',
  async (displayed, expected) => {
    mockAddresses = { publicAddress: displayed, privateAddress: OWN_UA };
    mockDetails = {
      inputOutputSource: 'account',
      sends: [
        entry({
          type: EOnChainHistoryTransferType.Transfer,
          from: OWN_T,
          address: OWN_T,
          isOwn: true,
        }),
      ],
      receives: [],
    };
    const result = await renderPage();
    expect(result.getByText(expected)).toBeTruthy();
    if (expected !== OWN_T) {
      expect(result.queryByText(OWN_T)).toBeNull();
    }
  },
);

it('names our transparent change output by pool', async () => {
  const change = `t1${'H'.repeat(33)}`;
  mockDetails = {
    inputOutputSource: 'public',
    sends: [
      entry({
        type: EOnChainHistoryTransferType.Transfer,
        from: OWN_T,
        address: OWN_T,
        isOwn: true,
      }),
    ],
    receives: [
      entry({
        type: EOnChainHistoryTransferType.Transfer,
        to: change,
        address: change,
        isOwn: true,
        isChange: true,
      }),
    ],
  };
  const result = await renderPage();
  expect(result.queryByText(change)).toBeNull();
  expect(result.getByText('Transparent pool')).toBeTruthy();
  expect(result.getByText(OWN_T)).toBeTruthy();
});

it('leaves non-privacy chains as they were', async () => {
  mockNetworkId = 'btc--0';
  mockDetails = {
    sends: [
      entry({
        type: EOnChainHistoryTransferType.Transfer,
        from: 'bc1-own',
        isOwn: true,
      }),
    ],
    receives: [
      entry({
        type: EOnChainHistoryTransferType.Transfer,
        to: 'bc1-other',
      }),
    ],
  };
  const result = await renderPage();
  expect(result.getByText('bc1-own')).toBeTruthy();
  expect(result.getByText('bc1-other')).toBeTruthy();
});
