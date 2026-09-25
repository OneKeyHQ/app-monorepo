import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
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
  const service = new ServiceSwap({
    backgroundApi: {
      serviceReferralCode: { getBoundEvmReferralCodeWalletInfo },
      serviceAccountProfile: { _getWalletTypeHeader: getWalletTypeHeader },
    },
  });
  jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
  return {
    service,
    getBoundEvmReferralCodeWalletInfo,
    getWalletTypeHeader,
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
});
