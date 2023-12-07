import {
  COINTYPE_STACKS,
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

  displayChars: 6,

  minGasLimit: 10,

  minTransferAmount: '5.46',

  hideInAllNetworksMode: false,

  isUTXOModel: false,

  accountNameInfo: {
    default: {
      prefix: 'STACKS',
      category: `44'/${COINTYPE_STACKS}'`,
      template: `m/44'/${COINTYPE_STACKS}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_STACKS,
      label: 'Default',
      subDesc: 'BIP44, P2PKH, c32check',
    },
  },
});

export default settings;
