import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  COINTYPE_APTOS,
  IMPL_APTOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import { EDBAccountType } from '../../../dbs/local/consts';

import { APTOS_NATIVE_COIN } from './utils';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'APT',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_APTOS}'/${INDEX_PLACEHOLDER}'/0'/0'`,
    coinType: COINTYPE_APTOS,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_APTOS,
  coinTypeDefault: COINTYPE_APTOS,
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
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 120,
  activateTokenRequired: true,

  customRpcEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
      nativeTokenAddress: APTOS_NATIVE_COIN,
    },
  },

  stakingConfig: {
    [getNetworkIdsMap().apt]: {
      providers: {
        [EEarnProviderEnum.Everstake]: {
          supportedSymbols: ['APT'],
          configs: {
            'APT': {
              enabled: true,
              tokenAddress: APTOS_NATIVE_COIN,
              displayProfit: true,
            },
          },
        },
      },
    },
  },
};

export default Object.freeze(settings);
