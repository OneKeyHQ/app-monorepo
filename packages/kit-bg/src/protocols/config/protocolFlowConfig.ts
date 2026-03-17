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
import {
  EEarnProviderEnum,
  type IStakingFlowConfig,
  type ISupportedSymbol,
} from '@onekeyhq/shared/types/earn';

export enum EProtocolFlowResolution {
  ByProvider = 'by_provider',
  BySymbol = 'by_symbol',
}

interface IProtocolProviderFlowConfigByProvider {
  resolution: EProtocolFlowResolution.ByProvider;
  flowConfig: IStakingFlowConfig;
}

interface IProtocolProviderFlowConfigBySymbol {
  resolution: EProtocolFlowResolution.BySymbol;
  symbolFlowConfigs: Partial<Record<ISupportedSymbol, IStakingFlowConfig>>;
}

type IProtocolProviderFlowConfig =
  | IProtocolProviderFlowConfigByProvider
  | IProtocolProviderFlowConfigBySymbol;

interface INetworkProtocolFlowConfig {
  providers: Partial<Record<EEarnProviderEnum, IProtocolProviderFlowConfig>>;
}

export type IProtocolFlowConfig = Readonly<
  Record<string, Readonly<INetworkProtocolFlowConfig>>
>;

function freezeSymbolFlowConfigs(
  symbolFlowConfigs: Partial<Record<ISupportedSymbol, IStakingFlowConfig>>,
) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(symbolFlowConfigs).map(([symbol, flowConfig]) => [
        symbol,
        Object.freeze({ ...flowConfig }),
      ]),
    ) as Partial<Record<ISupportedSymbol, IStakingFlowConfig>>,
  );
}

function byProvider(
  flowConfig: IStakingFlowConfig,
): IProtocolProviderFlowConfigByProvider {
  return Object.freeze({
    resolution: EProtocolFlowResolution.ByProvider,
    flowConfig: Object.freeze({ ...flowConfig }),
  });
}

function bySymbol(
  symbolFlowConfigs: Partial<Record<ISupportedSymbol, IStakingFlowConfig>>,
): IProtocolProviderFlowConfigBySymbol {
  return Object.freeze({
    resolution: EProtocolFlowResolution.BySymbol,
    symbolFlowConfigs: freezeSymbolFlowConfigs(symbolFlowConfigs),
  });
}

const networkIdMap = getNetworkIdsMap();

const commonStakeFlowConfigs = {
  eth: Object.freeze({
    enabled: true,
    tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
    displayProfit: true,
    stakingWithApprove: false,
  }),
  pol: Object.freeze({
    enabled: true,
    tokenAddress: EthereumPol,
    displayProfit: true,
    stakingWithApprove: true,
  }),
} satisfies Record<'eth' | 'pol', IStakingFlowConfig>;

const lidoEthFlowConfig = Object.freeze({
  ...commonStakeFlowConfigs.eth,
  unstakeWithSignMessage: true,
  claimWithAmount: true,
}) satisfies IStakingFlowConfig;

const pendleFlowConfig = Object.freeze({
  enabled: true,
  tokenAddress: '',
  displayProfit: true,
  stakingWithApprove: true,
  withdrawWithTx: true,
  claimWithTx: true,
}) satisfies IStakingFlowConfig;

const protocolFlowConfig = Object.freeze({
  [networkIdMap.apt]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Everstake]: bySymbol({
        APT: {
          enabled: true,
          tokenAddress: APTOS_NATIVE_COIN,
          displayProfit: true,
        },
      }),
    }),
  }),
  [networkIdMap.ada]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Stakefish]: bySymbol({
        ADA: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: true,
          withdrawWithTx: true,
          claimWithTx: false,
        },
      }),
    }),
  }),
  [networkIdMap.arbitrum]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
    }),
  }),
  [networkIdMap.base]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Morpho]: bySymbol({
        USDC: {
          enabled: true,
          tokenAddress: BaseUSDC,
          displayProfit: true,
          stakingWithApprove: true,
        },
      }),
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
    }),
  }),
  [networkIdMap.bsc]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Lista]: bySymbol({
        USDT: {
          enabled: true,
          tokenAddress: BinanceSmartChainUSDT,
          displayProfit: true,
          stakingWithApprove: true,
        },
        LISTA: {
          enabled: true,
          tokenAddress: BinanceSmartChainLISTA,
          displayProfit: true,
          stakingWithApprove: true,
        },
      }),
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
    }),
  }),
  [networkIdMap.btc]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Babylon]: bySymbol({
        BTC: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: false,
          withdrawWithTx: true,
          claimWithTx: true,
          usePublicKey: true,
          withdrawSignOnly: true,
        },
      }),
    }),
  }),
  [networkIdMap.cosmoshub]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Everstake]: bySymbol({
        ATOM: {
          enabled: true,
          tokenAddress: 'uatom',
          displayProfit: true,
          usePublicKey: true,
          claimWithAmount: true,
        },
      }),
      [EEarnProviderEnum.Stakefish]: bySymbol({
        ATOM: {
          enabled: true,
          tokenAddress: 'uatom',
          displayProfit: true,
          usePublicKey: true,
          claimWithAmount: true,
        },
      }),
    }),
  }),
  [networkIdMap.eth]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Lido]: bySymbol({
        ETH: lidoEthFlowConfig,
      }),
      [EEarnProviderEnum.Everstake]: bySymbol({
        ETH: {
          ...commonStakeFlowConfigs.eth,
          claimWithAmount: true,
        },
        POL: {
          ...commonStakeFlowConfigs.pol,
          claimWithTx: true,
        },
      }),
      [EEarnProviderEnum.Morpho]: bySymbol({
        USDC: {
          enabled: true,
          tokenAddress: EthereumUSDC,
          displayProfit: true,
          stakingWithApprove: true,
        },
        USDT: {
          enabled: true,
          tokenAddress: EthereumUSDT,
          displayProfit: true,
          stakingWithApprove: true,
        },
        DAI: {
          enabled: true,
          tokenAddress: EthereumDAI,
          displayProfit: true,
          stakingWithApprove: true,
        },
        WETH: {
          enabled: true,
          tokenAddress: EthereumWETH,
          displayProfit: true,
          stakingWithApprove: true,
        },
        cbBTC: {
          enabled: true,
          tokenAddress: EthereumCbBTC,
          displayProfit: true,
          stakingWithApprove: true,
        },
        WBTC: {
          enabled: true,
          tokenAddress: EthereumWBTC,
          displayProfit: true,
          stakingWithApprove: true,
        },
        MORPHO: {
          enabled: true,
          tokenAddress: EthereumMORPHO,
          displayProfit: true,
          stakingWithApprove: true,
        },
      }),
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
      [EEarnProviderEnum.Falcon]: bySymbol({
        USDf: {
          enabled: false,
          tokenAddress: EthereumUSDF,
          displayProfit: true,
          stakingWithApprove: true,
          withdrawWithTx: true,
        },
      }),
      [EEarnProviderEnum.Ethena]: bySymbol({
        USDe: {
          enabled: true,
          tokenAddress: EthereumUSDe,
          displayProfit: true,
          stakingWithApprove: false,
          withdrawWithTx: false,
        },
      }),
      [EEarnProviderEnum.Stakefish]: bySymbol({
        ETH: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: true,
          withdrawWithTx: true,
          claimWithTx: true,
          allowPartialWithdraw: true,
        },
        POL: {
          ...commonStakeFlowConfigs.pol,
          claimWithTx: true,
        },
      }),
    }),
  }),
  [networkIdMap.hoodi]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Stakefish]: bySymbol({
        ETH: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: true,
          withdrawWithTx: true,
          claimWithTx: true,
          allowPartialWithdraw: true,
        },
      }),
    }),
  }),
  [networkIdMap.hyperevm]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
    }),
  }),
  [networkIdMap.sbtc]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Babylon]: bySymbol({
        SBTC: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: false,
          withdrawWithTx: true,
          claimWithTx: true,
          usePublicKey: true,
          withdrawSignOnly: true,
        },
      }),
    }),
  }),
  [networkIdMap.sepolia]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Lido]: bySymbol({
        ETH: lidoEthFlowConfig,
      }),
    }),
  }),
  [networkIdMap.sol]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Everstake]: bySymbol({
        SOL: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: true,
          withdrawWithTx: true,
          claimWithTx: true,
        },
      }),
      [EEarnProviderEnum.Stakefish]: bySymbol({
        SOL: {
          enabled: true,
          tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
          displayProfit: true,
          withdrawWithTx: true,
          claimWithTx: true,
        },
      }),
      [EEarnProviderEnum.Kamino]: bySymbol({
        USDC: {
          enabled: true,
          tokenAddress: SolanaUSDC,
          displayProfit: true,
          claimWithTx: true,
        },
      }),
    }),
  }),
  [networkIdMap.sui]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Momentum]: bySymbol({
        USDC: {
          enabled: true,
          tokenAddress: SuiUSDC,
          displayProfit: true,
        },
        WBTC: {
          enabled: true,
          tokenAddress: SuiWBTC,
          displayProfit: true,
        },
      }),
    }),
  }),
  [PlasmaNetworkId]: Object.freeze({
    providers: Object.freeze({
      [EEarnProviderEnum.Pendle]: byProvider(pendleFlowConfig),
    }),
  }),
}) satisfies IProtocolFlowConfig;

export function getProtocolFlowConfig({
  networkId,
  provider,
  symbol,
}: {
  networkId: string;
  provider: EEarnProviderEnum;
  symbol: string;
}): IStakingFlowConfig | null {
  const networkConfig: INetworkProtocolFlowConfig | undefined =
    protocolFlowConfig[networkId];
  if (!networkConfig) {
    return null;
  }

  const providerConfig: IProtocolProviderFlowConfig | undefined =
    networkConfig.providers[provider];
  if (!providerConfig) {
    return null;
  }

  if (providerConfig.resolution === EProtocolFlowResolution.ByProvider) {
    return providerConfig.flowConfig;
  }

  return providerConfig.symbolFlowConfigs[symbol as ISupportedSymbol] ?? null;
}

export function findProtocolSymbolByTokenAddress({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}): { provider: EEarnProviderEnum; symbol: ISupportedSymbol } | null {
  const networkConfig: INetworkProtocolFlowConfig | undefined =
    protocolFlowConfig[networkId];
  if (!networkConfig) {
    return null;
  }

  const normalizedTokenAddress = tokenAddress.toLowerCase();

  // Several native staking providers intentionally share the empty native-token
  // address, so iteration order here defines the canonical provider precedence.
  const providerEntries = Object.entries(networkConfig.providers) as Array<
    [EEarnProviderEnum, IProtocolProviderFlowConfig]
  >;

  for (const [provider, providerConfig] of providerEntries) {
    if (providerConfig.resolution === EProtocolFlowResolution.BySymbol) {
      const symbolEntry = Object.entries(providerConfig.symbolFlowConfigs).find(
        ([, flowConfig]) =>
          flowConfig &&
          flowConfig.enabled &&
          flowConfig.tokenAddress.toLowerCase() === normalizedTokenAddress,
      );

      if (symbolEntry) {
        return {
          provider,
          symbol: symbolEntry[0] as ISupportedSymbol,
        };
      }
    }
  }

  return null;
}

export function listProtocolFlowNetworks(): string[] {
  return Object.keys(protocolFlowConfig);
}
