import type { LocaleIds } from '@onekeyhq/components/src/locale/';
import {
  COINTYPE_XMR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AccountCredentialType } from '../../../types/account';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  disabledInExtensionManifestV3: true,
  disabledInExtension: true,

  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: false,
  externalAccountEnabled: false,
  hardwareAccountEnabled: false,

  isUTXOModel: false,

  addressDerivationDisabled: true,
  validationRequired: true,

  accountNameInfo: {
    default: {
      prefix: 'XMR',
      category: `44'/${COINTYPE_XMR}'`,
      template: `m/44'/${COINTYPE_XMR}'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_XMR,
    },
  },

  exportCredentialInfo: [
    {
      type: AccountCredentialType.PrivateViewKey,
      key: 'action__export_view_key' as LocaleIds,
    },
    {
      type: AccountCredentialType.PrivateSpendKey,
      key: 'action__export_spend_key' as LocaleIds,
    },
    {
      type: AccountCredentialType.Mnemonic,
      key: 'action__export_secret_mnemonic' as LocaleIds,
    },
  ],

  txExtraInfo: [
    {
      key: 'txKey',
      title: 'form__secret_transaction_key' as LocaleIds,
      canCopy: true,
      isShorten: true,
    },
  ],
});

export default settings;
