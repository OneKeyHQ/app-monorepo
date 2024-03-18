import {
  COINTYPE_NEURAI,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { BulkTypeEnum } from '../../../types/batchTransfer';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  publicKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  minTransferAmount: '0.00000546',

  isUTXOModel: true,
  supportBatchTransfer: [BulkTypeEnum.OneToMany],
  nativeSupportBatchTransfer: true,

  accountNameInfo: {
    default: {
      prefix: 'Neurai',
      category: `44'/${COINTYPE_NEURAI}'`,
      template: `m/44'/${COINTYPE_NEURAI}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_NEURAI,
      label: 'Legacy',
      subDesc: 'BIP44, P2PKH, Base58.',
    },
  },

  isBtcForkChain: true,
});

export default settings;
