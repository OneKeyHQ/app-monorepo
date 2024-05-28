import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAirGapAccount } from '@onekeyhq/qr-wallet-sdk';

import type { INetworkAccountAddressDetail } from './address';

export type INetworkAccount = IDBAccount & {
  addressDetail: INetworkAccountAddressDetail;
};

export type IQrWalletAirGapAccount = IAirGapAccount & {
  // childrenPath?: string; // 0/* // TODO rename childPathTpl
  // xfp?: string; // generate from xpub
};

export type IQrWalletAirGapAccountsInfo = {
  accounts: IQrWalletAirGapAccount[];
};

export enum EQrWalletAccountNoteEvm {
  Standard = 'account.standard', // The BIP 44 standard xpub
  LedgerLegacy = 'account.ledger_legacy', // The Ledger Legacy xpub, same as BIP 44 xpub
  LedgerLive = 'account.ledger_live', // The Ledger Live public key
}
