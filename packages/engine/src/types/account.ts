import { HasName } from './base';

const ACCOUNT_TYPE_SIMPLE = 'simple';
const ACCOUNT_TYPE_MULADDR = 'muladdr';
// TODO: ACCOUNT_TYPE_MULVARIANT for cfx/cosmos/polkadot

type AccountType = 'simple' | 'muladdr';

type BaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
  tokens: Array<string>;
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
  SimpleAccount,
  MulAddrAccount,
  Account,
  ImportableHDAccount,
};
