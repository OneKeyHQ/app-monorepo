import type { LocaleIds } from '@onekeyhq/components/src/locale';

import type { HasName } from './base';
import type { Token } from './token';

enum AccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
  // used for allNetworks
  FAKE = 'FAKE',
}
// TODO: ACCOUNT_TYPE_MULVARIANT for cosmos/polkadot

enum AccountCredentialType {
  PrivateKey = 'PrivateKey',
  PrivateViewKey = 'PrivateViewKey',
  PrivateSpendKey = 'PrivateSpendKey',
  Mnemonic = 'Mnemonic',
}

type DBBaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
  template?: string;
};

type DBSimpleAccount = DBBaseAccount & {
  pub: string;
  address: string;
};

type DBUTXOAccount = DBBaseAccount & {
  pub?: string;
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc custom address
};

type DBVariantAccount = DBBaseAccount & {
  pub: string;
  address: string; // Base address
  addresses: Record<string, string>; // Network -> address
};

type DBAccount = DBSimpleAccount | DBUTXOAccount | DBVariantAccount;

type Account = DBBaseAccount & {
  tokens: Array<Token>;
  address: string;
  pubKey?: string;
  displayAddress?: string;
  xpub?: string; // for btc fork chain
  customAddresses?: string; // for btc custom address
  addresses?: string; // for lightning network
};

type ImportableHDAccount = {
  index: number;
  path: string;
  defaultName: string;
  displayAddress: string;
  mainBalance: string;
  template?: string;
};

type BtcForkChainUsedAccount = {
  transfers: number;
  name: string;
  path: string;
  decimals: number;
  balance: string;
  totalReceived: string;
  displayTotalReceived: string;
};

type AccountCredential = {
  type: AccountCredentialType;
  key: LocaleIds;
};

export { AccountType, AccountCredentialType };
export type {
  AccountCredential,
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
  DBAccount,
  Account,
  ImportableHDAccount,
  BtcForkChainUsedAccount,
};

export type IPrivateBTCExternalAccount = {
  address: string;
  coinType: string;
  path: string;
  xpub: string;
  template: string;
};
