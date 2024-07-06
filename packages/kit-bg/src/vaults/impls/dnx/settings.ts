import {
  COINTYPE_DNX,
  IMPL_DNX,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'DNX',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_DNX}'/0'/0'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_DNX,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_DNX,
  coinTypeDefault: COINTYPE_DNX,
  accountType: EDBAccountType.UTXO,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  softwareAccountDisabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: true,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 600 * 1000,

  withPaymentId: true,

  enabledOnClassicOnly: true,

  minTransferAmount: '0.000000001',

  withoutBroadcastTxId: true,

  hasFrozenBalance: true,

  hideTxUtxoListWhenPending: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
