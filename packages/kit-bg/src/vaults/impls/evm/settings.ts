import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
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
} from '@onekeyhq/shared/src/consts/addresses';
import {
  COINTYPE_ETH,
  IMPL_EVM,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IStakingConfig,
  IStakingFlowConfig,
} from '@onekeyhq/shared/types/earn';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapEvm = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  // etcNative: IAccountDeriveInfo;
  ledgerLive: IAccountDeriveInfo;
};
export type IAccountDeriveTypesEvm = keyof IAccountDeriveInfoMapEvm;

const networkIdMap = getNetworkIdsMap();

const commonStakeConfigs = {
  ETH: {
    enabled: true,
    tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
    displayProfit: true,
    stakingWithApprove: false,
  },
  POL: {
    enabled: true,
    tokenAddress: EthereumPol,
    displayProfit: true,
    stakingWithApprove: true,
  },
};

const lidoConfig: { ETH: IStakingFlowConfig } = {
  ETH: {
    ...commonStakeConfigs.ETH,
    enabled: true,
    unstakeWithSignMessage: true,
    claimWithAmount: true,
  },
};

const stakingConfig: IStakingConfig = {
  [getNetworkIdsMap().eth]: {
    providers: {
      [EEarnProviderEnum.Lido]: {
        supportedSymbols: ['ETH'],
        configs: lidoConfig,
      },
      [EEarnProviderEnum.Everstake]: {
        supportedSymbols: ['ETH', 'POL'],
        configs: {
          ETH: {
            ...commonStakeConfigs.ETH,
            claimWithAmount: true,
          },
          POL: {
            ...commonStakeConfigs.POL,
            claimWithTx: true,
          },
        },
      },
      [EEarnProviderEnum.Morpho]: {
        supportedSymbols: [
          'USDC',
          'USDT',
          'DAI',
          'WETH',
          'cbBTC',
          'WBTC',
          'MORPHO',
        ],
        configs: {
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
        },
      },
      [EEarnProviderEnum.Falcon]: {
        supportedSymbols: ['USDf'],
        configs: {
          USDf: {
            enabled: false,
            tokenAddress: EthereumUSDF,
            displayProfit: true,
            stakingWithApprove: true,
            withdrawWithTx: true,
          },
        },
      },
      [EEarnProviderEnum.Ethena]: {
        supportedSymbols: ['USDe'],
        configs: {
          USDe: {
            enabled: true,
            tokenAddress: EthereumUSDe,
            displayProfit: true,
            stakingWithApprove: false,
            withdrawWithTx: false,
          },
        },
      },
      [EEarnProviderEnum.Stakefish]: {
        supportedSymbols: ['ETH', 'POL'],
        configs: {
          ETH: {
            enabled: true,
            tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
            displayProfit: true,
            withdrawWithTx: true,
            claimWithTx: true,
            allowPartialWithdraw: true,
          },
          POL: {
            ...commonStakeConfigs.POL,
            claimWithTx: true,
          },
        },
      },
    },
  },
  [getNetworkIdsMap().base]: {
    providers: {
      [EEarnProviderEnum.Morpho]: {
        supportedSymbols: ['USDC', 'MORPHO'],
        configs: {
          USDC: {
            enabled: true,
            tokenAddress: BaseUSDC,
            displayProfit: true,
            stakingWithApprove: true,
          },
        },
      },
    },
  },
  [getNetworkIdsMap().sepolia]: {
    providers: {
      [EEarnProviderEnum.Lido]: {
        supportedSymbols: ['ETH'],
        configs: {
          ...lidoConfig,
        },
      },
    },
  },
  [getNetworkIdsMap().bsc]: {
    providers: {
      [EEarnProviderEnum.Lista]: {
        supportedSymbols: ['USDT', 'LISTA'],
        configs: {
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
        },
      },
    },
  },
  [getNetworkIdsMap().hoodi]: {
    providers: {
      [EEarnProviderEnum.Stakefish]: {
        supportedSymbols: ['ETH'],
        configs: {
          ETH: {
            enabled: true,
            tokenAddress: EMPTY_NATIVE_TOKEN_ADDRESS,
            displayProfit: true,
            withdrawWithTx: true,
            claimWithTx: true,
            allowPartialWithdraw: true,
          },
        },
      },
    },
  },
};

const accountDeriveInfo: IAccountDeriveInfoMapEvm = {
  default: {
    // category: `44'/${COINTYPE_ETH}'`,
    namePrefix: 'EVM',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_ETH}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_ETH,
    desc: `OneKey, MetaMask, Trezor, imToken, m/44'/60'/0'/0/*`,
  },
  // TODO
  // etcNative: {
  //   // category: `44'/${COINTYPE_ETH}'`,
  //   namePrefix: 'ETC-Native',
  //   labelKey: 'form__bip44_standard_cointype_61',
  //   template: `m/44'/${COINTYPE_ETC}'/0'/0/${INDEX_PLACEHOLDER}`,
  //   coinType: COINTYPE_ETC,
  //   desc: `m'/44'/61'/0'/*`,
  //   // ETC only, hide in other EVM chains
  //   enableConditions: [
  //     {
  //       networkId: [NETWORK_ID_ETC], // ETC
  //     },
  //   ],
  // },
  ledgerLive: {
    // category: `44'/${COINTYPE_ETH}'`,
    namePrefix: 'EVM Ledger Live',
    label: 'Ledger Live',
    idSuffix: 'LedgerLive', // hd-1--m/44'/60'/0'/0/0--LedgerLive
    template: `m/44'/${COINTYPE_ETH}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_ETH,
    desc: `m/44'/60'/*'/0/0`,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_EVM,
  coinTypeDefault: COINTYPE_ETH,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: true,
  watchingAccountEnabled: true,
  qrAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  dappInteractionEnabled: true,

  defaultFeePresetIndex: 1,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: true,
  canEditNonce: true,
  canEditData: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: true,
  cancelTxEnabled: true,
  speedUpCancelEnabled: true,

  withL1BaseFee: true,
  transferZeroNativeTokenEnabled: true,
  gasLimitValidationEnabled: true,
  estimatedFeePollingInterval: 6,
  editApproveAmountEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },

  maxSendFeeUpRatio: {
    [networkIdMap.fevm]: 1.1,
    [networkIdMap.flare]: 1.1,
    [networkIdMap.mantle]: 1.2,
    [networkIdMap.mantapacific]: 1.2,
    [networkIdMap.blast]: 1.2,
    [networkIdMap.hsk]: 1.2,
  },

  customRpcEnabled: true,

  stakingConfig,
  stakingResultPollingInterval: 5,

  withTxMessage: true,

  shouldFixMaxSendAmount: true,

  supportBatchEstimateFee: {
    [networkIdMap.eth]: true,
    [networkIdMap.sepolia]: true,
    [networkIdMap.arbitrum]: true,
    [networkIdMap.avalanche]: true,
    [networkIdMap.base]: true,
    [networkIdMap.optimism]: true,
    [networkIdMap.polygon]: true,
    [networkIdMap.blast]: true,
    [networkIdMap.bob]: true,
    [networkIdMap.metis]: true,
    [networkIdMap.mode]: true,
    [networkIdMap.taiko]: true,
    [networkIdMap.mantle]: true,
  },

  enabledInternalSignAndVerify: true,
};

export default Object.freeze(settings);
