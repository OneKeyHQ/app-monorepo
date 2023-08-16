import {
  COINTYPE_NEXA,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  isFeeRateMode: true,
  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  displayChars: 8,

  minGasLimit: 10,

  // can't send amount lower than the dust threshold, which si 546 satoshi or 5.46 NEX
  minTransferAmount: '5.46',

  hideInAllNetworksMode: true,

  isUTXOModel: true,

  accountNameInfo: {
    default: {
      prefix: 'NEXA',
      category: `44'/${COINTYPE_NEXA}'`,
      template: `m/44'/${COINTYPE_NEXA}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_NEXA,
      label: 'Legacy',
      subDesc: 'BIP44, P2PKH, Base58.',
    },
  },
});

export default settings;
