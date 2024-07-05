import {
  COINTYPE_NOSTR,
  IMPL_NOSTR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'NOSTR',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_NOSTR}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_NOSTR,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_NOSTR,
  coinTypeDefault: COINTYPE_NOSTR,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  addressBookDisabled: true,

  disabledSendAction: true,
  disabledSwapAction: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },

  hideBlockExplorer: true,
};

export default Object.freeze(settings);
