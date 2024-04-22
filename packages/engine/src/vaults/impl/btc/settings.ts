import {
  COINTYPE_BTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { BulkTypeEnum } from '../../../types/batchTransfer';

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
  externalAccountEnabled: true,
  watchingAccountEnabled: true,

  minTransferAmount: '0.00000546',

  isUTXOModel: true,
  supportBatchTransfer: [BulkTypeEnum.OneToMany],
  nativeSupportBatchTransfer: true,

  signOnlyReturnFullTx: true,
  hideFromToFieldIfValueEmpty: true,

  accountNameInfo: {
    default: {
      prefix: 'BTC Nested SegWit',
      category: `49'/${COINTYPE_BTC}'`,
      template: `m/49'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: '3' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP86: {
      prefix: 'BTC Taproot',
      category: `86'/${COINTYPE_BTC}'`,
      template: `m/86'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Taproot',
      desc: {
        id: 'form__bitcoin__taproot_desc',
        placeholder: { 0: 'bc1p' },
      },
      subDesc: 'BIP86, P2TR, Bech32m.',
    },
    BIP84: {
      prefix: 'BTC Native SegWit',
      category: `84'/${COINTYPE_BTC}'`,
      template: `m/84'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'bc1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32.',
    },
    BIP44: {
      prefix: 'BTC Legacy',
      category: `44'/${COINTYPE_BTC}'`,
      template: `m/44'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: '1' } },
      subDesc: 'BIP44, P2PKH, Base58.',
      notRecommended: true,
    },
  } as Record<string, AccountNameInfo>,

  isBtcForkChain: true,
});

export default settings;
