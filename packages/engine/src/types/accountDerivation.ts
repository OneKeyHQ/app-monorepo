import type { BaseObject } from './base';

export type DBAccountDerivation = BaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};
