import {
  COINTYPE_ETH,
  IMPL_EVM,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'TODO',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_ETH}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_ETH,
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

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30 * 1000,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
