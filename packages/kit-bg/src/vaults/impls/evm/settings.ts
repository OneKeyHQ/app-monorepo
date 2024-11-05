import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EMPTY_NATIVE_TOKEN_ADDRESS,
  EthereumMatic,
  SepoliaMatic,
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
  MATIC: {
    enabled: true,
    tokenAddress: EthereumMatic,
    displayProfit: true,
    stakingWithApprove: true,
  },
};

const lidoConfig: { ETH: IStakingFlowConfig; MATIC: IStakingFlowConfig } = {
  ETH: {
    ...commonStakeConfigs.ETH,
    enabled: true,
    unstakeWithSignMessage: true,
    claimWithAmount: true,
  },
  MATIC: {
    ...commonStakeConfigs.MATIC,
    enabled: true,
    claimWithTx: true,
  },
};

const stakingConfig: IStakingConfig = {
  [getNetworkIdsMap().eth]: {
    providers: {
      [EEarnProviderEnum.Lido]: {
        supportedSymbols: ['ETH', 'MATIC'],
        configs: lidoConfig,
      },
      [EEarnProviderEnum.Everstake]: {
        supportedSymbols: ['ETH', 'MATIC'],
        configs: {
          ETH: {
            ...commonStakeConfigs.ETH,
            claimWithAmount: true,
          },
          MATIC: {
            ...commonStakeConfigs.MATIC,
            claimWithTx: true,
          },
        },
      },
    },
  },
  [getNetworkIdsMap().sepolia]: {
    providers: {
      [EEarnProviderEnum.Lido]: {
        supportedSymbols: ['ETH', 'MATIC'],
        configs: {
          ...lidoConfig,
          MATIC: { ...lidoConfig.MATIC, tokenAddress: SepoliaMatic },
        },
      },
    },
  },
  [getNetworkIdsMap().holesky]: {
    providers: {
      [EEarnProviderEnum.Everstake]: {
        supportedSymbols: ['ETH', 'MATIC'],
        configs: {
          ETH: commonStakeConfigs.ETH,
          MATIC: commonStakeConfigs.MATIC,
        },
      },
      [EEarnProviderEnum.Lido]: {
        supportedSymbols: ['ETH'],
        configs: {
          ETH: lidoConfig.ETH,
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
  },

  customRpcEnabled: true,

  stakingConfig,
};

export default Object.freeze(settings);
