import type { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  COINTYPE_LIGHTNING,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  isUTXOModel: false,

  accountNameInfo: {
    default: {
      prefix: 'Lightning',
      category: `44'/${COINTYPE_LIGHTNING}'`,
      template: `m/44'/${COINTYPE_LIGHTNING}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_LIGHTNING,
    },
  },

  validationRequired: true,
  hiddenNFTTab: true,
  hiddenToolTab: true,
  hiddenAddress: true,
  hiddenAccountInfoMoreOption: false,
  customAccountInfoSwapOption: true,
  displayMemo: true,
  hideFromToFieldIfValueEmpty: true,
  hideFeeSpeedInfo: true,
  rpcStatusDisabled: true,
  useSimpleTipForSpecialCheckEncodedTx: true,

  hideInAllNetworksMode: true,

  allowZeroFee: true,

  txExtraInfo: [
    {
      key: 'preimage',
      title: 'form__preimage' as LocaleIds,
      canCopy: false,
      isShorten: false,
    },
    {
      key: 'memo',
      title: 'content__description' as LocaleIds,
      canCopy: false,
      isShorten: false,
      numberOfLines: 10,
    },
  ],
});

export default settings;
