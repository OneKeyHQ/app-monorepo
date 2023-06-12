import type { DBAccount } from '../src/types/account';
import type { DBNetwork } from '../src/types/network';

export interface IUnitTestMockAccount {
  account: DBAccount;
  password: string;
  privateKey?: string;
  mnemonic?: string;
  accounts?: DBAccount[];
}

export interface IPrepareMockVaultOptions {
  password?: string;
  mnemonic?: string;
  privateKey?: string;
  dbAccount: DBAccount;
  dbNetwork: DBNetwork;
  accountIdPrefix?: string;
}
