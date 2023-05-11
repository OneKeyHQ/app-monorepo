import BigNumber from 'bignumber.js';

import {
  COINTYPE_KASPA,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { DUST_AMOUNT } from './sdk';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,

  minTransferAmount: new BigNumber(DUST_AMOUNT).shiftedBy(-8).toString(),

  accountNameInfo: {
    default: {
      prefix: 'KASPA',
      category: `44'/${COINTYPE_KASPA}'`,
      template: `m/44'/${COINTYPE_KASPA}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_KASPA,
      label: 'Schnorr',
    },
  },
});

export default settings;
