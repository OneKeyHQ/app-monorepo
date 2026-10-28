/* eslint-disable import/first */
const mockFetchTokenDetailsByApi = jest.fn();
const mockGetChainOnlyVault = jest.fn(
  async (_params: { networkId: string }) => ({
    fetchTokenDetailsByApi: mockFetchTokenDetailsByApi,
  }),
);
jest.mock('../factory', () => ({
  vaultFactory: {
    getChainOnlyVault: (params: { networkId: string }) =>
      mockGetChainOnlyVault(params),
  },
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import {
  applyLocalWalletNativePriceToHistoryTx,
  fetchLocalWalletNativeTokenPrice,
  isLocalWalletHistoryTxUnpriced,
} from './nativeTokenPrice';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function createBackgroundApi() {
  const getNativeTokenAddress = jest.fn(async () => '');
  const backgroundApi = {
    serviceToken: { getNativeTokenAddress },
  } as unknown as IBackgroundApi;
  return { backgroundApi, getNativeTokenAddress };
}

describe('local wallet native price lookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['xmr--0', 'zec--0'])(
    'asks the wallet token search by network alone on %s',
    async (networkId) => {
      const { backgroundApi } = createBackgroundApi();
      mockFetchTokenDetailsByApi.mockResolvedValue({
        data: { data: [{ info: { address: '' }, price: '4021.08' }] },
      });
      await expect(
        fetchLocalWalletNativeTokenPrice({
          backgroundApi,
          networkId,
          requestCurrency: 'cny',
        }),
      ).resolves.toBe(4021.08);
      // The whole request is the asset identity: no account field exists to fill.
      expect(mockFetchTokenDetailsByApi.mock.calls).toEqual([
        [{ networkId, contractList: [''], requestCurrency: 'cny' }],
      ]);
    },
  );

  it.each([
    ['an unsupported network', new OneKeyLocalError('40056')],
    ['an empty result', { data: { data: [] } }],
    ['a zero quote', { data: { data: [{ info: { address: '' }, price: 0 }] } }],
  ])('reports no price for %s', async (_label, outcome) => {
    const { backgroundApi } = createBackgroundApi();
    if (outcome instanceof Error) {
      mockFetchTokenDetailsByApi.mockRejectedValue(outcome);
    } else {
      mockFetchTokenDetailsByApi.mockResolvedValue(outcome);
    }
    await expect(
      fetchLocalWalletNativeTokenPrice({ backgroundApi, networkId: 'xmr--0' }),
    ).resolves.toBeUndefined();
  });

  it('never throws, even when a service is missing', async () => {
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi: {} as IBackgroundApi,
        networkId: 'xmr--0',
      }),
    ).resolves.toBeUndefined();
  });
});

function transfer(
  extra?: Partial<IDecodedTxTransferInfo>,
): IDecodedTxTransferInfo {
  return {
    from: '',
    to: '',
    amount: '2',
    icon: '',
    name: 'Monero',
    symbol: 'XMR',
    tokenIdOnNetwork: '',
    isNative: true,
    ...extra,
  };
}

function historyTx({
  sends = [],
  receives = [],
  totalFeeInNative,
  totalFeeFiatValue,
}: {
  sends?: IDecodedTxTransferInfo[];
  receives?: IDecodedTxTransferInfo[];
  totalFeeInNative?: string;
  totalFeeFiatValue?: string;
}): IAccountHistoryTx {
  return {
    id: 'xmr--0_tx',
    decodedTx: {
      txid: 'tx',
      owner: '',
      signer: '',
      nonce: 0,
      networkId: 'xmr--0',
      accountId: 'hd-1--x',
      status: EDecodedTxStatus.Confirmed,
      extraInfo: null,
      totalFeeInNative,
      totalFeeFiatValue,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: { from: '', to: '', sends, receives },
        },
      ],
    },
  };
}

describe('local wallet history pricing', () => {
  it('prices unpriced native amounts and the fee', () => {
    const tx = historyTx({
      sends: [transfer()],
      totalFeeInNative: '0.5',
    });
    expect(isLocalWalletHistoryTxUnpriced(tx)).toBe(true);
    const priced = applyLocalWalletNativePriceToHistoryTx({ tx, price: 150 });
    expect(priced.decodedTx.actions[0].assetTransfer?.sends[0].price).toBe(
      '150',
    );
    expect(priced.decodedTx.totalFeeFiatValue).toBe('75');
    expect(isLocalWalletHistoryTxUnpriced(priced)).toBe(false);
    // The input row is left as it was.
    expect(tx.decodedTx.actions[0].assetTransfer?.sends[0].price).toBe(
      undefined,
    );
  });

  it('keeps every quote the source already gave', () => {
    const tx = historyTx({
      receives: [transfer({ price: '149' })],
      totalFeeInNative: '0.5',
      totalFeeFiatValue: '74.5',
    });
    expect(isLocalWalletHistoryTxUnpriced(tx)).toBe(false);
    expect(applyLocalWalletNativePriceToHistoryTx({ tx, price: 150 })).toBe(tx);
  });

  it('leaves non-native amounts alone', () => {
    const tx = historyTx({
      receives: [transfer({ isNative: false, tokenIdOnNetwork: 'token' })],
    });
    expect(isLocalWalletHistoryTxUnpriced(tx)).toBe(false);
    expect(applyLocalWalletNativePriceToHistoryTx({ tx, price: 150 })).toBe(tx);
  });
});
