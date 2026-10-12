import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTradeSource,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  decimals: 6,
  symbol: 'FROM',
};

const buildParams = {
  accountId: 'account-1',
  fromToken,
  toToken: { ...fromToken, contractAddress: '0xto', symbol: 'TO' },
  fromTokenAmount: '1',
  toTokenAmount: '2',
  provider: 'test-provider',
  userAddress: '0xsender',
  receivingAddress: '0xreceiver',
  slippagePercentage: 0.5,
  protocol: EProtocolOfExchange.SWAP,
  kind: ESwapQuoteKind.SELL,
  tradeSource: ESwapTradeSource.SWAP_BRIDGE,
};

function createService() {
  const getBoundEvmReferralCodeWalletInfo = jest.fn().mockResolvedValue({
    address: '0xbound',
    networkId: 'evm--1',
    rebateAddress: '0xrebate',
  });
  const getWalletTypeHeader = jest
    .fn()
    .mockResolvedValue({ 'X-OneKey-Wallet-Type': 'hd' });
  const post = jest.fn().mockResolvedValue({ data: { data: {} } });
  const getAccountDeviceSafe = jest.fn().mockResolvedValue(null);
  const service = new ServiceSwap({
    backgroundApi: {
      serviceReferralCode: { getBoundEvmReferralCodeWalletInfo },
      serviceAccountProfile: { _getWalletTypeHeader: getWalletTypeHeader },
      serviceAccount: { getAccountDeviceSafe },
    },
  });
  jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
  return {
    service,
    getBoundEvmReferralCodeWalletInfo,
    getWalletTypeHeader,
    getAccountDeviceSafe,
    post,
  };
}

describe('ServiceSwap build transaction context', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('prepares referral and wallet header before building an order', async () => {
    const {
      service,
      getBoundEvmReferralCodeWalletInfo,
      getWalletTypeHeader,
      post,
    } = createService();
    let resolveReferral!: (value: {
      address: string;
      networkId: string;
      rebateAddress: string;
    }) => void;
    getBoundEvmReferralCodeWalletInfo.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReferral = resolve;
      }),
    );
    const pendingContext = service.prepareSwapBuildTxContext({
      accountId: buildParams.accountId,
      protocol: buildParams.protocol,
    });

    expect(getBoundEvmReferralCodeWalletInfo).toHaveBeenCalledTimes(1);
    expect(getWalletTypeHeader).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    resolveReferral({
      address: '0xbound',
      networkId: 'evm--1',
      rebateAddress: '0xrebate',
    });
    const context = await pendingContext;
    expect(context.referralBuildTxParams).toEqual({
      bindedAccountAddress: '0xbound',
      bindedNetworkId: 'evm--1',
      rebateAddress: '0xrebate',
    });

    await service.fetchBuildTx({ ...buildParams, preparedContext: context });
    expect(getBoundEvmReferralCodeWalletInfo).toHaveBeenCalledTimes(1);
    expect(getWalletTypeHeader).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining(context.referralBuildTxParams),
      { headers: context.walletTypeHeader },
    );
  });

  it('rebuilds context when the prepared account does not match', async () => {
    const { service, getBoundEvmReferralCodeWalletInfo, getWalletTypeHeader } =
      createService();
    const context = await service.prepareSwapBuildTxContext({
      accountId: 'another-account',
      protocol: buildParams.protocol,
    });

    await service.fetchBuildTx({ ...buildParams, preparedContext: context });
    expect(getBoundEvmReferralCodeWalletInfo).toHaveBeenCalledTimes(2);
    expect(getWalletTypeHeader).toHaveBeenCalledTimes(2);
  });

  it('uses the account device and preserves the quote source', async () => {
    const { service, getAccountDeviceSafe, post } = createService();
    getAccountDeviceSafe.mockResolvedValueOnce({ deviceType: 'pro2' });

    await service.fetchBuildTx({
      ...buildParams,
      source: ESwapQuoteSource.MARKET,
    });

    expect(getAccountDeviceSafe).toHaveBeenCalledWith({
      accountId: buildParams.accountId,
    });
    expect(post).toHaveBeenCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining({
        deviceType: 'pro2',
        source: ESwapQuoteSource.MARKET,
      }),
      expect.any(Object),
    );
  });

  it('keeps Market attribution and the quoted provider for native BTC outbound builds', async () => {
    const { service, post } = createService();
    const quotedProvider = 'legacy-btc-provider';

    await service.fetchBuildTx({
      ...buildParams,
      fromToken: {
        networkId: 'btc--0',
        contractAddress: '',
        decimals: 8,
        symbol: 'BTC',
        isNative: true,
      },
      provider: quotedProvider,
      source: ESwapQuoteSource.MARKET,
    });

    expect(post).toHaveBeenCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining({
        fromNetworkId: 'btc--0',
        toNetworkId: 'evm--1',
        fromTokenAddress: '',
        provider: quotedProvider,
        source: ESwapQuoteSource.MARKET,
      }),
      expect.any(Object),
    );
  });

  it('keeps an explicit device without an additional account lookup', async () => {
    const { service, getAccountDeviceSafe, post } = createService();

    await service.fetchBuildTx({ ...buildParams, deviceType: 'neo' });

    expect(getAccountDeviceSafe).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining({ deviceType: 'neo', source: undefined }),
      expect.any(Object),
    );
  });

  it('allows software wallets and accountless requests without device metadata', async () => {
    const { service, getAccountDeviceSafe, post } = createService();

    await service.fetchBuildTx(buildParams);
    await service.fetchBuildTx({ ...buildParams, accountId: undefined });

    expect(getAccountDeviceSafe).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining({ deviceType: undefined }),
      expect.any(Object),
    );
  });
});
