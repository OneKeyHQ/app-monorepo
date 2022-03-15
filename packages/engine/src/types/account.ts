import { HasName } from './base';
import { Token } from './token';

enum AccountType {
  SIMPLE = 'simple',
  MULADDR = 'muladdr',
  VARIANT = 'variant',
}
// TODO: ACCOUNT_TYPE_MULVARIANT for cosmos/polkadot

type DBBaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
};

type DBSimpleAccount = DBBaseAccount & {
  pub: string;
  address: string;
};

type DBMulAddrAccount = DBBaseAccount & {
  xpub: string;
  address: string; // Display/selected address
  addresses: Record<string, string>;
};

type DBVariantAccount = DBBaseAccount & {
  pub: string;
  address: string; // Base address
  addresses: Record<string, string>; // Network -> address
};

type DBAccount = DBSimpleAccount | DBMulAddrAccount | DBVariantAccount;

type Account = DBBaseAccount & {
  tokens: Array<Token>;
  address: string;
};

type ImportableHDAccount = {
  index: number;
  path: string;
  displayAddress: string;
  mainBalance: string;
};

export { AccountType };
export type {
  DBSimpleAccount,
  DBMulAddrAccount,
  DBVariantAccount,
  DBAccount,
  Account,
  ImportableHDAccount,
};
