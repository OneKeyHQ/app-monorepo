import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  APTOS_NATIVE_COIN,
  BaseUSDC,
  BinanceSmartChainLISTA,
  BinanceSmartChainUSDT,
  EMPTY_NATIVE_TOKEN_ADDRESS,
  EthereumCbBTC,
  EthereumDAI,
  EthereumMORPHO,
  EthereumPol,
  EthereumUSDC,
  EthereumUSDF,
  EthereumUSDT,
  EthereumUSDe,
  EthereumWBTC,
  EthereumWETH,
  PlasmaNetworkId,
  SolanaUSDC,
  SuiUSDC,
  SuiWBTC,
} from '@onekeyhq/shared/src/consts/addresses';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IStakingFlowConfig } from '@onekeyhq/shared/types/earn';

import {
  findProtocolSymbolByTokenAddress,
  getProtocolFlowConfig,
  listProtocolFlowNetworks,
} from './protocolFlowConfig';

describe('protocolFlowConfig', () => {
  const networkIdMap = getNetworkIdsMap();
  const pendleFlowConfig: IStakingFlowConfig = {
    enabled: true,
    tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
    displayProfit: true,
    stakingWithApprove: true,
    withdrawWithTx: true,
    claimWithTx: true,
  };
  const commonEthStakeFlowConfig: IStakingFlowConfig = {
    enabled: true,
    tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
    displayProfit: true,
    stakingWithApprove: false,
  };
  const lidoEthFlowConfig: IStakingFlowConfig = {
    ...commonEthStakeFlowConfig,
    unstakeWithSignMessage: true,
    claimWithAmount: true,
  };
  const polFlowConfig: IStakingFlowConfig = {
    enabled: true,
    tokenAddress: EthereumPol,
    displayProfit: true,
    stakingWithApprove: true,
  };
  const providerTokenCases: Array<{
    name: string;
    params: {
      networkId: string;
      provider: EEarnProviderEnum;
      symbol: string;
    };
    expected: IStakingFlowConfig;
  }> = [
    {
      name: 'Aptos Everstake APT',
      params: {
        networkId: networkIdMap.apt,
        provider: EEarnProviderEnum.Everstake,
        symbol: 'APT',
      },
      expected: {
        enabled: true,
        tokenAddress: APTOS_NATIVE_COIN,
        displayProfit: true,
      },
    },
    {
      name: 'Cardano Stakefish ADA',
      params: {
        networkId: networkIdMap.ada,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'ADA',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: true,
        withdrawWithTx: true,
        claimWithTx: false,
      },
    },
    {
      name: 'Arbitrum Pendle representative token',
      params: {
        networkId: networkIdMap.arbitrum,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
    {
      name: 'Base Morpho USDC',
      params: {
        networkId: networkIdMap.base,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'USDC',
      },
      expected: {
        enabled: true,
        tokenAddress: BaseUSDC,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Base Pendle representative token',
      params: {
        networkId: networkIdMap.base,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
    {
      name: 'BSC Lista USDT',
      params: {
        networkId: networkIdMap.bsc,
        provider: EEarnProviderEnum.Lista,
        symbol: 'USDT',
      },
      expected: {
        enabled: true,
        tokenAddress: BinanceSmartChainUSDT,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'BSC Lista LISTA',
      params: {
        networkId: networkIdMap.bsc,
        provider: EEarnProviderEnum.Lista,
        symbol: 'LISTA',
      },
      expected: {
        enabled: true,
        tokenAddress: BinanceSmartChainLISTA,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'BSC Pendle representative token',
      params: {
        networkId: networkIdMap.bsc,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
    {
      name: 'Bitcoin Babylon BTC',
      params: {
        networkId: networkIdMap.btc,
        provider: EEarnProviderEnum.Babylon,
        symbol: 'BTC',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: false,
        withdrawWithTx: true,
        claimWithTx: true,
        usePublicKey: true,
        withdrawSignOnly: true,
      },
    },
    {
      name: 'Cosmoshub Everstake ATOM',
      params: {
        networkId: networkIdMap.cosmoshub,
        provider: EEarnProviderEnum.Everstake,
        symbol: 'ATOM',
      },
      expected: {
        enabled: true,
        tokenAddress: 'uatom',
        displayProfit: true,
        usePublicKey: true,
        claimWithAmount: true,
      },
    },
    {
      name: 'Cosmoshub Stakefish ATOM',
      params: {
        networkId: networkIdMap.cosmoshub,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'ATOM',
      },
      expected: {
        enabled: true,
        tokenAddress: 'uatom',
        displayProfit: true,
        usePublicKey: true,
        claimWithAmount: true,
      },
    },
    {
      name: 'Ethereum Lido ETH',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Lido,
        symbol: 'ETH',
      },
      expected: lidoEthFlowConfig,
    },
    {
      name: 'Ethereum Everstake ETH',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Everstake,
        symbol: 'ETH',
      },
      expected: {
        ...commonEthStakeFlowConfig,
        claimWithAmount: true,
      },
    },
    {
      name: 'Ethereum Everstake POL',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Everstake,
        symbol: 'POL',
      },
      expected: {
        ...polFlowConfig,
        claimWithTx: true,
      },
    },
    {
      name: 'Ethereum Morpho USDC',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'USDC',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumUSDC,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho USDT',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'USDT',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumUSDT,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho DAI',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'DAI',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumDAI,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho WETH',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'WETH',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumWETH,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho cbBTC',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'cbBTC',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumCbBTC,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho WBTC',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'WBTC',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumWBTC,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Morpho MORPHO',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'MORPHO',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumMORPHO,
        displayProfit: true,
        stakingWithApprove: true,
      },
    },
    {
      name: 'Ethereum Pendle representative token',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
    {
      name: 'Ethereum Falcon USDf',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Falcon,
        symbol: 'USDf',
      },
      expected: {
        enabled: false,
        tokenAddress: EthereumUSDF,
        displayProfit: true,
        stakingWithApprove: true,
        withdrawWithTx: true,
      },
    },
    {
      name: 'Ethereum Ethena USDe',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Ethena,
        symbol: 'USDe',
      },
      expected: {
        enabled: true,
        tokenAddress: EthereumUSDe,
        displayProfit: true,
        stakingWithApprove: false,
        withdrawWithTx: false,
      },
    },
    {
      name: 'Ethereum Stakefish ETH',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'ETH',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: true,
        withdrawWithTx: true,
        claimWithTx: true,
        allowPartialWithdraw: true,
      },
    },
    {
      name: 'Ethereum Stakefish POL',
      params: {
        networkId: networkIdMap.eth,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'POL',
      },
      expected: {
        ...polFlowConfig,
        claimWithTx: true,
      },
    },
    {
      name: 'Hoodi Stakefish ETH',
      params: {
        networkId: networkIdMap.hoodi,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'ETH',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: true,
        withdrawWithTx: true,
        claimWithTx: true,
        allowPartialWithdraw: true,
      },
    },
    {
      name: 'HyperEVM Pendle representative token',
      params: {
        networkId: networkIdMap.hyperevm,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
    {
      name: 'sBTC Babylon SBTC',
      params: {
        networkId: networkIdMap.sbtc,
        provider: EEarnProviderEnum.Babylon,
        symbol: 'SBTC',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: false,
        withdrawWithTx: true,
        claimWithTx: true,
        usePublicKey: true,
        withdrawSignOnly: true,
      },
    },
    {
      name: 'Sepolia Lido ETH',
      params: {
        networkId: networkIdMap.sepolia,
        provider: EEarnProviderEnum.Lido,
        symbol: 'ETH',
      },
      expected: lidoEthFlowConfig,
    },
    {
      name: 'Solana Everstake SOL',
      params: {
        networkId: networkIdMap.sol,
        provider: EEarnProviderEnum.Everstake,
        symbol: 'SOL',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: true,
        withdrawWithTx: true,
        claimWithTx: true,
      },
    },
    {
      name: 'Solana Stakefish SOL',
      params: {
        networkId: networkIdMap.sol,
        provider: EEarnProviderEnum.Stakefish,
        symbol: 'SOL',
      },
      expected: {
        enabled: true,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
        displayProfit: true,
        withdrawWithTx: true,
        claimWithTx: true,
      },
    },
    {
      name: 'Solana Kamino representative token',
      params: {
        networkId: networkIdMap.sol,
        provider: EEarnProviderEnum.Kamino,
        symbol: 'USDC',
      },
      expected: {
        enabled: true,
        tokenAddress: SolanaUSDC,
        displayProfit: true,
        claimWithTx: true,
      },
    },
    {
      name: 'Sui Momentum USDC',
      params: {
        networkId: networkIdMap.sui,
        provider: EEarnProviderEnum.Momentum,
        symbol: 'USDC',
      },
      expected: {
        enabled: true,
        tokenAddress: SuiUSDC,
        displayProfit: true,
      },
    },
    {
      name: 'Sui Momentum WBTC',
      params: {
        networkId: networkIdMap.sui,
        provider: EEarnProviderEnum.Momentum,
        symbol: 'WBTC',
      },
      expected: {
        enabled: true,
        tokenAddress: SuiWBTC,
        displayProfit: true,
      },
    },
    {
      name: 'Plasma Pendle representative token',
      params: {
        networkId: PlasmaNetworkId,
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      },
      expected: pendleFlowConfig,
    },
  ];

  it.each(providerTokenCases)(
    'returns the expected flow config for $name',
    ({ params, expected }) => {
      expect(getProtocolFlowConfig(params)).toEqual(expected);
    },
  );

  it('preserves legacy null behavior when a provider had no concrete symbol config', () => {
    expect(
      getProtocolFlowConfig({
        networkId: networkIdMap.base,
        provider: EEarnProviderEnum.Morpho,
        symbol: 'MORPHO',
      }),
    ).toBeNull();
  });

  it('finds static token-address mappings through the new authoritative config', () => {
    expect(
      findProtocolSymbolByTokenAddress({
        networkId: networkIdMap.eth,
        tokenAddress: '0xA0b86991C6218B36C1d19D4A2E9Eb0cE3606eB48',
      }),
    ).toEqual({
      provider: EEarnProviderEnum.Morpho,
      symbol: 'USDC',
    });

    expect(
      findProtocolSymbolByTokenAddress({
        networkId: networkIdMap.eth,
        tokenAddress: EthereumUSDe,
      }),
    ).toEqual({
      provider: EEarnProviderEnum.Ethena,
      symbol: 'USDe',
    });
  });

  it('skips provider-level configs during reverse lookup', () => {
    expect(
      findProtocolSymbolByTokenAddress({
        networkId: networkIdMap.arbitrum,
        tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
      }),
    ).toBeNull();
  });

  it('preserves the canonical provider precedence for native-token reverse lookup', () => {
    expect(
      findProtocolSymbolByTokenAddress({
        networkId: networkIdMap.eth,
        tokenAddress: '',
      }),
    ).toEqual({
      provider: EEarnProviderEnum.Lido,
      symbol: 'ETH',
    });
  });

  it('skips disabled tokens during reverse lookup', () => {
    expect(
      findProtocolSymbolByTokenAddress({
        networkId: networkIdMap.eth,
        tokenAddress: EthereumUSDF,
      }),
    ).toBeNull();
  });

  it('returns null for unknown networks and providers', () => {
    expect(
      getProtocolFlowConfig({
        networkId: 'evm--unknown',
        provider: EEarnProviderEnum.Pendle,
        symbol: 'PT-sUSDe-2026',
      }),
    ).toBeNull();

    expect(
      getProtocolFlowConfig({
        networkId: networkIdMap.eth,
        provider: 'Unknown' as EEarnProviderEnum,
        symbol: 'ETH',
      }),
    ).toBeNull();
  });

  it('tracks all networks that define protocol flow config', () => {
    expect(listProtocolFlowNetworks().toSorted()).toEqual(
      [
        networkIdMap.ada,
        networkIdMap.apt,
        networkIdMap.arbitrum,
        networkIdMap.base,
        networkIdMap.bsc,
        networkIdMap.btc,
        networkIdMap.cosmoshub,
        networkIdMap.eth,
        networkIdMap.hoodi,
        networkIdMap.hyperevm,
        PlasmaNetworkId,
        networkIdMap.sbtc,
        networkIdMap.sepolia,
        networkIdMap.sol,
        networkIdMap.sui,
      ].toSorted(),
    );
  });
});
