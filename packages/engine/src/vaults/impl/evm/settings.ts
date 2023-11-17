import {
  COINTYPE_ETC,
  COINTYPE_ETH,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { BulkTypeEnum } from '../../../types/batchTransfer';

import type { AccountNameInfo } from '../../../types/network';
import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: true,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: true,
  watchingAccountEnabled: true,

  isUTXOModel: false,

  subNetworkSettings: {
    // GateChain
    'evm--86': {
      isIntegerGasPrice: true,
    },
  },

  supportFilterScam: true,
  supportBatchTransfer: [
    BulkTypeEnum.OneToMany,
    BulkTypeEnum.ManyToMany,
    BulkTypeEnum.ManyToOne,
  ],

  batchTransferApprovalRequired: true,
  batchTransferApprovalConfirmRequired: true,

  nonceEditable: true,
  sendNFTEnable: true,
  hexDataEditable: true,

  showPendingTxsWarning: true,

  accountNameInfo: {
    default: {
      prefix: 'EVM',
      category: `44'/${COINTYPE_ETH}'`,
      template: `m/44'/${COINTYPE_ETH}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_ETH,
      label: { id: 'form__bip44_standard' },
      desc: { id: `form__bip44_standard_desc` },
      recommended: true,
    },
    etcNative: {
      prefix: 'ETC-Native',
      category: `44'/${COINTYPE_ETC}'`,
      template: `m/44'/${COINTYPE_ETC}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_ETC,
      label: { id: 'form__bip44_standard_cointype_61' },
    },
    ledgerLive: {
      prefix: 'Ledger Live',
      category: `44'/${COINTYPE_ETH}'`,
      template: `m/44'/${COINTYPE_ETH}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_ETH,
      label: 'Ledger Live',
    },
  } as Record<string, AccountNameInfo>,
});

export default settings;
