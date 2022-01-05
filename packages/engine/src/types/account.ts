import { HasName } from './base';
import { Token } from './token';

const ACCOUNT_TYPE_SIMPLE = 'simple';
const ACCOUNT_TYPE_MULADDR = 'muladdr';
// TODO: ACCOUNT_TYPE_MULVARIANT for cfx/cosmos/polkadot

type AccountType = 'simple' | 'muladdr';

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
  addresses: Record<string, string>;
};

type DBAccount = DBSimpleAccount | DBMulAddrAccount;

type BaseAccount = DBBaseAccount & {
  tokens: Array<Token>;
};

type SimpleAccount = BaseAccount & {
  pub: string;
  address: string;
};

type MulAddrAccount = BaseAccount & {
  xpub: string;
  addresses: Map<string, string>; // Address => relative path
};

type Account = SimpleAccount | MulAddrAccount;

type ImportableHDAccount = {
  index: number;
  path: string;
  mainBalance: number;
};

export { ACCOUNT_TYPE_SIMPLE, ACCOUNT_TYPE_MULADDR };
export type {
  AccountType,
  DBSimpleAccount,
  DBMulAddrAccount,
  DBAccount,
  SimpleAccount,
  MulAddrAccount,
  Account,
  ImportableHDAccount,
};
