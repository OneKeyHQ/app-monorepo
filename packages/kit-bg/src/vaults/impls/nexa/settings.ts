import {
  COINTYPE_NEXA,
  IMPL_NEXA,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'NEXA',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_NEXA}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_NEXA,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_NEXA,
  coinTypeDefault: COINTYPE_NEXA,
  accountType: EDBAccountType.UTXO,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: true, //
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: true,
  editFeeEnabled: true,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
  minTransferAmount: '5.46',
  defaultFeePresetIndex: 1,
};

export default Object.freeze(settings);
