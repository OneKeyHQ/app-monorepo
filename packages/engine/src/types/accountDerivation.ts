import type { BaseObject } from './base';

export type DBAccountDerivation = BaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};

export type ISetAccountTemplateParams = {
  accountId: string;
  template: string;
};

export type IAddAccountDerivationParams = {
  walletId: string;
  accountId: string;
  impl: string;
  template: string;
  derivationStore?: IDBObjectStore;
};
