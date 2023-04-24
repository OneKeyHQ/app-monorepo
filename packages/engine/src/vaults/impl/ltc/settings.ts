import {
  COINTYPE_LTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { AccountNameInfo } from '../../../types/network';
import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  publicKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  minTransferAmount: '0.00000546',

  isUTXOModel: true,

  accountNameInfo: {
    default: {
      prefix: 'LTC Nested SegWit',
      category: `49'/${COINTYPE_LTC}'`,
      template: `m/49'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: 'M' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP84: {
      prefix: 'LTC Native SegWit',
      category: `84'/${COINTYPE_LTC}'`,
      template: `m/84'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'ltc1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32. ',
    },
    BIP44: {
      prefix: 'LTC Legacy',
      category: `44'/${COINTYPE_LTC}'`,
      template: `m/44'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: 'L' } },
      subDesc: 'BIP44, P2PKH, Base58.',
      notRecommended: true,
    },
  } as Record<string, AccountNameInfo>,

  isBtcForkChain: true,
});

export default settings;
