import {
  COINTYPE_CFX,
  IMPL_CFX,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'CFX',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_CFX}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_CFX,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_CFX,
  coinTypeDefault: COINTYPE_CFX,
  accountType: EDBAccountType.VARIANT,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,

  defaultFeePresetIndex: 0,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
