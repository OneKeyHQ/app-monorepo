/* eslint-disable import/first */
const mockFetchTokenDetails = jest.fn();
const mockGetChainOnlyVault = jest.fn(
  async (_params: { networkId: string }) => ({
    fetchTokenDetails: mockFetchTokenDetails,
  }),
);
jest.mock('../factory', () => ({
  vaultFactory: {
    getChainOnlyVault: (params: { networkId: string }) =>
      mockGetChainOnlyVault(params),
  },
}));
jest.mock('../settings', () => ({
  getVaultSettings: async ({ networkId }: { networkId: string }) =>
    networkId === 'xmr--0'
      ? { localWallet: { marketCoingeckoId: 'monero' } }
      : {},
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
  const fetchMarketTokenDetailByTokenAddress = jest.fn();
  const fetchMarketTokenDetail = jest.fn();
  const getNativeTokenAddress = jest.fn(async () => '');
  const backgroundApi = {
    serviceMarket: { fetchMarketTokenDetail },
    serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
    serviceToken: { getNativeTokenAddress },
  } as unknown as IBackgroundApi;
  return {
    backgroundApi,
    fetchMarketTokenDetail,
    fetchMarketTokenDetailByTokenAddress,
    getNativeTokenAddress,
  };
}

describe('local wallet native price lookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks market detail by market id for Monero, which has no network quote', async () => {
    const {
      backgroundApi,
      fetchMarketTokenDetail,
      fetchMarketTokenDetailByTokenAddress,
    } = createBackgroundApi();
    fetchMarketTokenDetail.mockResolvedValue({
      stats: { currentPrice: '4021.08' },
    });
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi,
        networkId: 'xmr--0',
        backendIndex: false,
        requestCurrency: 'cny',
      }),
    ).resolves.toBe(4021.08);
    // The whole request is the asset identity: no account field exists to fill.
    expect(fetchMarketTokenDetail.mock.calls).toEqual([
      ['monero', false, 'cny'],
    ]);
    expect(fetchMarketTokenDetailByTokenAddress).not.toHaveBeenCalled();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('asks market detail for the bare native asset on another unindexed chain', async () => {
    const { backgroundApi, fetchMarketTokenDetailByTokenAddress } =
      createBackgroundApi();
    fetchMarketTokenDetailByTokenAddress.mockResolvedValue({
      data: { token: { price: '150', priceConverted: '1080' } },
    });
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi,
        networkId: 'other--0',
        backendIndex: false,
        requestCurrency: 'cny',
      }),
    ).resolves.toBe(1080);
    expect(fetchMarketTokenDetailByTokenAddress.mock.calls).toEqual([
      ['', 'other--0', { autoHandleError: false }],
    ]);
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('asks the account-free token search on an indexed chain', async () => {
    const { backgroundApi, fetchMarketTokenDetailByTokenAddress } =
      createBackgroundApi();
    mockFetchTokenDetails.mockResolvedValue({
      data: { data: [{ info: { address: '' }, price: 42 }] },
    });
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi,
        networkId: 'zec--0',
        backendIndex: true,
        requestCurrency: 'usd',
      }),
    ).resolves.toBe(42);
    expect(mockFetchTokenDetails.mock.calls).toEqual([
      [{ networkId: 'zec--0', contractList: [''], requestCurrency: 'usd' }],
    ]);
    expect(fetchMarketTokenDetailByTokenAddress).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported network', new OneKeyLocalError('30011')],
    ['an empty quote', undefined],
  ])('reports no price for %s', async (_label, error) => {
    const { backgroundApi, fetchMarketTokenDetailByTokenAddress } =
      createBackgroundApi();
    if (error) {
      fetchMarketTokenDetailByTokenAddress.mockRejectedValue(error);
    } else {
      fetchMarketTokenDetailByTokenAddress.mockResolvedValue({
        data: { token: { price: '0' } },
      });
    }
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi,
        networkId: 'other--0',
        backendIndex: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('never throws, even when a service is missing', async () => {
    await expect(
      fetchLocalWalletNativeTokenPrice({
        backgroundApi: {} as IBackgroundApi,
        networkId: 'xmr--0',
        backendIndex: false,
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
