import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { SuiUSDC, SuiWBTC } from '@onekeyhq/shared/src/consts/addresses';
import {
  COINTYPE_SUI,
  IMPL_SUI,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'SUI',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_SUI}'/${INDEX_PLACEHOLDER}'/0'/0'`,
    coinType: COINTYPE_SUI,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_SUI,
  coinTypeDefault: COINTYPE_SUI,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  dappInteractionEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 120,
  customRpcEnabled: true,

  stakingConfig: {
    [getNetworkIdsMap().sui]: {
      providers: {
        [EEarnProviderEnum.Momentum]: {
          supportedSymbols: ['USDC', 'WBTC'],
          configs: {
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
          },
        },
      },
    },
  },

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
      nativeTokenAddress: SUI_TYPE_ARG,
    },
  },
};

export default Object.freeze(settings);
