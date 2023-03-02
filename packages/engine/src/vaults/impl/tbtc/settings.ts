import {
  COINTYPE_TBTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { AccountNameInfo } from '../../../types/network';
import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
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
      prefix: 'TBTC Nested SegWit',
      category: `49'/${COINTYPE_TBTC}'`,
      template: `m/49'/${COINTYPE_TBTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: '2' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP44: {
      prefix: 'TBTC Legacy',
      category: `44'/${COINTYPE_TBTC}'`,
      template: `m/44'/${COINTYPE_TBTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: 'm' } },
      subDesc: 'BIP44, P2PKH, Base58.',
    },
    BIP84: {
      prefix: 'TBTC Native SegWit',
      category: `84'/${COINTYPE_TBTC}'`,
      template: `m/84'/${COINTYPE_TBTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'tb1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32. ',
    },
  } as Record<string, AccountNameInfo>,
});

export default settings;
