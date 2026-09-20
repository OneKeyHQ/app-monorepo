import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import {
  buildLocalAccountTransactionMarks,
  mergeAccountTransactionMarks,
} from './localAccountTransactionMarks';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => {
  const { createIntl } =
    jest.requireActual<typeof import('react-intl')>('react-intl');
  return {
    appLocale: {
      onLocaleChange: jest.fn(),
      intl: {
        ...createIntl({ locale: 'en' }),
        formatMessage: (
          _message: unknown,
          values: { Amount: string; From_Token: string },
        ) => `${values.Amount} ${values.From_Token}`,
      },
    },
  };
});

const params = {
  accountAddress: 'Account',
  networkId: 'sol--101',
  tokenAddress: 'Token',
  from: 1000,
  to: 2000,
};

function createHistory(): ISwapTxHistory {
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.SUCCESS,
    accountInfo: {
      sender: { networkId: 'sol--101' },
      receiver: { networkId: 'sol--101' },
    },
    baseInfo: {
      fromToken: {
        networkId: 'sol--101',
        contractAddress: '',
        symbol: 'SOL',
        decimals: 9,
      },
      toToken: {
        networkId: 'sol--101',
        contractAddress: 'Token',
        symbol: 'TOKEN',
        decimals: 6,
      },
      fromAmount: '1',
      toAmount: '10',
    },
    txInfo: { txId: 'TestTransaction', sender: 'Account', receiver: 'Account' },
    swapInfo: {
      provider: { provider: 'test', providerName: 'Test' },
      instantRate: '10',
    },
    date: { created: 1_500_000, updated: 1_501_000 },
  };
}

describe('local account transaction marks', () => {
  it('uses a confirmed local buy and its stable submission time', () => {
    const history = createHistory();
    history.date.updated = 3_000_000;
    const marks = buildLocalAccountTransactionMarks({
      ...params,
      histories: [history],
    });
    expect(marks).toEqual([
      expect.objectContaining({
        label: 'B',
        time: 1500,
        transactionHash: 'TestTransaction',
        text: '10 TOKEN',
      }),
    ]);
  });

  it('uses the sold amount and source account for sell marks', () => {
    const history = createHistory();
    const marks = buildLocalAccountTransactionMarks({
      ...params,
      tokenAddress: '',
      histories: [history],
    });
    expect(marks).toEqual([
      expect.objectContaining({ label: 'S', text: '1 SOL' }),
    ]);
    history.txInfo.sender = 'OtherAccount';
    expect(
      buildLocalAccountTransactionMarks({
        ...params,
        tokenAddress: '',
        histories: [history],
      }),
    ).toEqual([]);
  });

  it.each([
    ESwapTxHistoryStatus.PENDING,
    ESwapTxHistoryStatus.FAILED,
    ESwapTxHistoryStatus.PARTIALLY_FILLED,
    ESwapTxHistoryStatus.CANCELED,
  ])('never treats %s as a confirmed fill', (status) => {
    expect(
      buildLocalAccountTransactionMarks({
        ...params,
        histories: [{ ...createHistory(), status }],
      }),
    ).toEqual([]);
  });

  it('excludes private transfers, unsigned/order-only history and cross-chain swaps', () => {
    const privateHistory = {
      ...createHistory(),
      protocol: EProtocolOfExchange.PRIVATE_SEND,
    };
    const orderHistory = createHistory();
    orderHistory.txInfo.useOrderId = true;
    const missingHash = createHistory();
    missingHash.txInfo.txId = undefined;
    const bridgeHistory = createHistory();
    bridgeHistory.baseInfo.fromToken.networkId = 'evm--1';
    expect(
      buildLocalAccountTransactionMarks({
        ...params,
        histories: [privateHistory, orderHistory, missingHash, bridgeHistory],
      }),
    ).toEqual([]);
  });

  it('requires the selected account, network, token and candle range, preserving Solana case', () => {
    for (const overrides of [
      { accountAddress: 'account' },
      { tokenAddress: 'token' },
      { networkId: 'evm--1' },
      { from: 1501 },
      { to: 1499 },
    ]) {
      expect(
        buildLocalAccountTransactionMarks({
          ...params,
          ...overrides,
          histories: [createHistory()],
        }),
      ).toEqual([]);
    }
  });

  it('excludes legacy private transfers identified only by their provider', () => {
    const history = createHistory();
    history.protocol = undefined;
    history.swapInfo.provider.provider = privateSendProvider;
    expect(
      buildLocalAccountTransactionMarks({ ...params, histories: [history] }),
    ).toEqual([]);
  });

  it('accepts EVM checksum differences and reconciles indexed fills by transaction and side', () => {
    const history = createHistory();
    history.baseInfo.fromToken.networkId = 'evm--1';
    history.baseInfo.toToken.networkId = 'evm--1';
    history.baseInfo.toToken.contractAddress = '0xAbC';
    history.txInfo.receiver = '0xDeF';
    history.txInfo.txId = '0xAAA';
    const localMarks = buildLocalAccountTransactionMarks({
      ...params,
      networkId: 'evm--1',
      accountAddress: '0xdef',
      tokenAddress: '0xabc',
      histories: [history],
    });
    expect(localMarks).toHaveLength(1);
    const serverMark = {
      ...localMarks[0],
      id: 'server-mark',
      transactionHash: '0xaaa',
      time: 1502,
      text: '9.9 TOKEN',
    };
    expect(
      mergeAccountTransactionMarks({
        localMarks,
        serverMarks: [],
        from: params.from,
        to: params.to,
      }),
    ).toEqual(localMarks);
    expect(
      mergeAccountTransactionMarks({
        localMarks,
        serverMarks: [serverMark],
        from: params.from,
        to: params.to,
      }),
    ).toEqual([serverMark]);
  });
});
