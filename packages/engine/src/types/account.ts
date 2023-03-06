import type { HasName } from './base';
import type { Token } from './token';

enum AccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
}
// TODO: ACCOUNT_TYPE_MULVARIANT for cosmos/polkadot

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
  xpub: string;
  address: string; // Display/selected address
  addresses: Record<string, string>;
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
  displayAddress?: string;
};

type ImportableHDAccount = {
  index: number;
  path: string;
  defaultName: string;
  displayAddress: string;
  mainBalance: string;
  template?: string;
};

export { AccountType };
export type {
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
  DBAccount,
  Account,
  ImportableHDAccount,
};
