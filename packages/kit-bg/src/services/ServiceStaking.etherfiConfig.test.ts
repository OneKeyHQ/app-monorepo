import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EtherFiLiquidReferContract,
  EthereumCbBTC,
  EthereumEBTC,
  EthereumEETH,
  EthereumStETH,
  EthereumUSDC,
  EthereumUSDT,
  EthereumWBTC,
  EthereumWETH,
  EthereumWeETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import {
  getSymbolSupportedNetworks,
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IEarnPermit2ApproveSignData } from '@onekeyhq/shared/types/staking';

import evmSettings from '../vaults/impls/evm/settings';

import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

const accountAddress = '0x1111111111111111111111111111111111111111';
const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const networks = getNetworkIdsMap();

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      getAccount: async () => ({ address: accountAddress }),
    })),
  },
}));

/** Keep the real config lookup so provider registration cannot be hidden by a mock. */
function createServiceHarness() {
  const service = new ServiceStaking({
    backgroundApi: {
      serviceNetwork: {
        getVaultSettings: jest.fn().mockResolvedValue(evmSettings),
      },
      serviceReferralCode: {
        checkAndUpdateReferralCode: jest.fn().mockResolvedValue(undefined),
      },
    },
  });
  const txResponse = {
    tx: {
      from: accountAddress,
      to: protocolVault,
      data: '0x1234',
      value: '0x0',
    },
    orderId: 'order-id',
  };
  const post = jest
    .fn<
      Promise<{ data: { data: typeof txResponse } }>,
      [string, Record<string, unknown>]
    >()
    .mockResolvedValue({ data: { data: txResponse } });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ post } as unknown as AxiosInstance);
  return { service, post, txResponse };
}

describe('ServiceStaking EtherFi registration', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['WETH', EthereumWETH],
    ['eETH', EthereumEETH],
    ['weETH', EthereumWeETH],
    ['stETH', EthereumStETH],
    ['USDC', EthereumUSDC],
    ['USDT', EthereumUSDT],
    ['WBTC', EthereumWBTC],
    ['cbBTC', EthereumCbBTC],
    ['eBTC', EthereumEBTC],
  ])(
    'enables Ethereum %s through the generic approval flow',
    async (symbol, tokenAddress) => {
      const { service } = createServiceHarness();

      await expect(
        service.getStakingConfigs({
          networkId: networks.eth,
          provider: 'etherfi',
          symbol,
        }),
      ).resolves.toEqual({
        enabled: true,
        tokenAddress,
        displayProfit: true,
        stakingWithApprove: true,
      });
    },
  );

  it('resolves canonical provider casing and leaves native ETH without ERC20 approval', async () => {
    const { service } = createServiceHarness();

    await expect(
      service.getStakingConfigs({
        networkId: networks.eth,
        provider: EEarnProviderEnum.EtherFi,
        symbol: 'ETH',
      }),
    ).resolves.toEqual({
      enabled: true,
      tokenAddress: '',
      displayProfit: true,
      stakingWithApprove: false,
    });
    expect(normalizeToEarnProvider('etherfi')).toBe(EEarnProviderEnum.EtherFi);
  });

  it.each([
    { networkId: networks.eth, provider: 'unknown', symbol: 'eETH' },
    { networkId: networks.base, provider: 'etherfi', symbol: 'eETH' },
    { networkId: networks.arbitrum, provider: 'etherfi', symbol: 'weETH' },
    { networkId: networks.eth, provider: 'etherfi', symbol: 'DAI' },
  ])(
    'keeps unsupported provider/network/symbol combinations disabled: %j',
    async (params) => {
      const { service } = createServiceHarness();

      await expect(service.getStakingConfigs(params)).resolves.toBeNull();
    },
  );

  it.each(['eETH', 'weETH', 'stETH', 'eBTC'] as const)(
    'normalizes %s and includes Ethereum in its supported networks',
    (symbol) => {
      expect(normalizeToEarnSymbol(symbol.toUpperCase())).toBe(symbol);
      expect(getSymbolSupportedNetworks()[symbol]).toContain(networks.eth);
    },
  );

  it.each([EApproveType.Legacy, EApproveType.Permit])(
    'builds an eETH transaction with real config for %s approval',
    async (approveType) => {
      const { service, post, txResponse } = createServiceHarness();
      const unsignedMessage: IEarnPermit2ApproveSignData = {
        domain: {
          name: 'EETH',
          version: '1',
          chainId: 1,
          verifyingContract: EthereumEETH,
        },
        primaryType: 'Permit',
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        message: {
          owner: accountAddress,
          spender: EtherFiLiquidReferContract,
          value: '1000000000000000000',
          nonce: '0',
          deadline: '18446744073709551615',
        },
      };
      const permitSignature = `0x${'11'.repeat(65)}`;

      await expect(
        service.buildStakeTransaction({
          accountId: "hd-1--m/44'/60'/0'/0/0",
          networkId: networks.eth,
          provider: 'etherfi',
          symbol: 'eETH',
          protocolVault,
          inputTokenAddress: EthereumEETH,
          amount: '1',
          approveType,
          ...(approveType === EApproveType.Permit
            ? { permitSignature, unsignedMessage }
            : {}),
        }),
      ).resolves.toEqual(txResponse);

      expect(post).toHaveBeenCalledWith(
        '/earn/v2/stake',
        expect.objectContaining({
          networkId: networks.eth,
          provider: 'etherfi',
          symbol: 'eETH',
          vault: protocolVault,
          inputTokenAddress: EthereumEETH,
          amount: '1',
          approveType,
          permitSignature:
            approveType === EApproveType.Permit ? permitSignature : undefined,
          unsignedMessage:
            approveType === EApproveType.Permit ? unsignedMessage : undefined,
        }),
      );
    },
  );
});
