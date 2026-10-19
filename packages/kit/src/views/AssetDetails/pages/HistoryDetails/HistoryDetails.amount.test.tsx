/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { render, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import HistoryDetails from './HistoryDetails';

let mockHistory: IAccountHistoryTx;

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
    Page: Object.assign(container, { Header: () => null, Body: container }),
    SizableText: container,
    Spinner: () => null,
    Stack: container,
    XStack: container,
    YStack: container,
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
      impl: 'xmr',
      symbol: 'XMR',
      name: 'Monero',
    },
    vaultSettings: { localWallet: { publicAddressPattern: '(?!)' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (_request: unknown, deps: unknown[]) => ({
    result: deps.length === 2 ? { symbol: 'XMR' } : {},
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
jest.mock('./components/TxDetailsInfoItem', () => ({
  InfoItem: () => null,
  InfoItemGroup: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
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
