import {
  COINTYPE_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { BulkTypeEnum } from '../../../types/batchTransfer';

import type { AccountNameInfo } from '../../../types/network';
import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  supportBatchTransfer: [BulkTypeEnum.OneToMany],
  nativeSupportBatchTransfer: true,
  maxActionsInTx: 8,
  sendNFTEnable: true,
  accountNameInfo: {
    default: {
      prefix: 'SOL',
      category: `44'/${COINTYPE_SOL}'`,
      template: `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'/0'`,
      coinType: COINTYPE_SOL,
      label: { id: 'form__bip44_standard' },
      desc: 'OneKey, Phantom, Sollet',
      recommended: true,
    },
    ledgerLive: {
      prefix: 'Ledger Live',
      category: `44'/${COINTYPE_SOL}'`,
      template: `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_SOL,
      label: 'Ledger Live',
      desc: 'Ledger Live, Solflare',
    },
  } as Record<string, AccountNameInfo>,
});

export default settings;
