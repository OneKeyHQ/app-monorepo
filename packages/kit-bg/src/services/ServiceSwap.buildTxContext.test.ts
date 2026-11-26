import platformEnv from '@onekeyhq/shared/src/platformEnv';
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

const xmrToken: ISwapToken = {
  networkId: 'xmr--0',
  contractAddress: '',
  decimals: 12,
  symbol: 'XMR',
  isNative: true,
};
const xmrPrimaryAddress = `4${'aB'.repeat(47)}`;

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
  const getAccountAddressForApi = jest
    .fn()
    .mockResolvedValue(xmrPrimaryAddress);
  const localValidateAddress = jest.fn().mockResolvedValue({ isValid: true });
  const service = new ServiceSwap({
    backgroundApi: {
      serviceReferralCode: { getBoundEvmReferralCodeWalletInfo },
      serviceAccountProfile: { _getWalletTypeHeader: getWalletTypeHeader },
      serviceAccount: { getAccountDeviceSafe, getAccountAddressForApi },
      serviceValidator: { localValidateAddress },
    },
  });
  jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
  return {
    service,
    getBoundEvmReferralCodeWalletInfo,
    getWalletTypeHeader,
    getAccountDeviceSafe,
    getAccountAddressForApi,
    localValidateAddress,
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

  it.each(['SwapChangelly', 'SwapRocketX'])(
    'accepts %s XMR orders with both bound IDs',
    async (provider) => {
      jest.replaceProperty(platformEnv, 'isWeb', false);
      const { service, localValidateAddress, post } = createService();
      const params = {
        ...buildParams,
        provider,
        toToken: xmrToken,
        receivingAddress: xmrPrimaryAddress,
      };
      const build = {
        orderId: 'onekey-order',
        changellyOrder: {
          orderId: 'channel-order',
          payinAddress: '0xdeposit',
          amountExpectedFrom: '1.0',
        },
        result: {
          info: { provider },
          fromTokenInfo: params.fromToken,
          toTokenInfo: params.toToken,
          fromAmount: '1',
        },
        ctx:
          provider === 'SwapChangelly'
            ? { changellyOrderId: 'channel-order' }
            : { rocketXOrderId: 'channel-order' },
      };
      post.mockResolvedValueOnce({ data: { data: build } });

      await expect(service.fetchBuildTx(params)).resolves.toEqual(build);
      expect(localValidateAddress).toHaveBeenCalledWith({
        networkId: 'xmr--0',
        address: xmrPrimaryAddress,
      });
      expect(post).toHaveBeenCalledWith(
        '/swap/v1/build-tx',
        expect.objectContaining({ receivingAddress: xmrPrimaryAddress }),
        expect.any(Object),
      );

      post.mockResolvedValueOnce({
        data: { data: { ...build, orderId: undefined } },
      });
      await expect(service.fetchBuildTx(params)).rejects.toThrow(
        'XMR swap order could not be verified',
      );

      for (const inconsistentBuild of [
        { ...build, swftOrder: { platformAddr: '0xdeposit' } },
        { ...build, result: { ...build.result, fromAmount: '2' } },
        {
          ...build,
          result: {
            ...build.result,
            fromTokenInfo: { ...build.result.fromTokenInfo, isNative: true },
          },
        },
        {
          ...build,
          result: {
            ...build.result,
            fromTokenInfo: { ...build.result.fromTokenInfo, decimals: 18 },
          },
        },
        { ...build, orderId: undefined, reviewQuoteExpiredBeforeSubmit: true },
      ]) {
        post.mockResolvedValueOnce({ data: { data: inconsistentBuild } });
        await expect(service.fetchBuildTx(params)).rejects.toThrow(
          'XMR swap order could not be verified',
        );
      }

      post.mockResolvedValueOnce({
        data: { data: { ...build, reviewQuoteExpiredBeforeSubmit: true } },
      });
      await expect(service.fetchBuildTx(params)).resolves.toEqual(build);

      post.mockResolvedValueOnce({
        data: {
          data: {
            ...build,
            changellyOrder: {
              ...build.changellyOrder,
              orderId: 'unbound-order',
            },
          },
        },
      });
      await expect(service.fetchBuildTx(params)).rejects.toThrow(
        'XMR swap order could not be verified',
      );
    },
  );

  it('keeps the XMR refund address bound to the source account before calling the service', async () => {
    jest.replaceProperty(platformEnv, 'isWeb', false);
    const { service, getAccountAddressForApi, post } = createService();
    const params = {
      ...buildParams,
      fromToken: xmrToken,
      userAddress: `4${'cD'.repeat(47)}`,
      provider: 'SwapChangelly',
    };

    await expect(service.fetchBuildTx(params)).rejects.toThrow();
    expect(getAccountAddressForApi).toHaveBeenCalledWith({
      accountId: params.accountId,
      networkId: 'xmr--0',
    });
    expect(post).not.toHaveBeenCalled();
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

  it('sends Sweep order attribution separately from the trade entry', async () => {
    const { service, post } = createService();

    await service.fetchBuildTx({
      ...buildParams,
      source: ESwapQuoteSource.SWEEP,
      quoteResultCtx: { routeId: 'sweep-route' },
    });

    expect(post).toHaveBeenCalledWith(
      '/swap/v1/build-tx',
      expect.objectContaining({
        source: 'Sweep',
        tradeSource: 'swapBridge',
        protocol: 'Swap',
        quoteResultCtx: { routeId: 'sweep-route' },
        userAddress: '0xsender',
        receivingAddress: '0xreceiver',
      }),
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
