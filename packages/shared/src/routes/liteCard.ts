import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum ELiteCardRoutes {
  LiteCardHome = 'LiteCardHome',
  LiteCardSelectWallet = 'LiteCardSelectWallet',
}

export type ILiteCardParamList = {
  [ELiteCardRoutes.LiteCardHome]: undefined;
  [ELiteCardRoutes.LiteCardSelectWallet]: {
    onPick?: (item: IDBWallet) => void;
  };
};
