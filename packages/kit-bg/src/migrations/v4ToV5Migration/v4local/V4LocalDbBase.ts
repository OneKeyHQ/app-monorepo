import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { V4LocalDbBaseContainer } from './V4LocalDbBaseContainer';

import type { IV4DBWallet, IV4DBWalletIdSingleton } from './v4localDBTypes';
import type { IV4AvatarInfo } from '../v4types';

export abstract class V4LocalDbBase extends V4LocalDbBaseContainer {
  buildSingletonWalletRecord({
    walletId,
  }: {
    walletId: IV4DBWalletIdSingleton;
  }) {
    const walletConfig: Record<
      IV4DBWalletIdSingleton,
      {
        avatar: IV4AvatarInfo;
        walletNo: number;
      }
    > = {
      [WALLET_TYPE_IMPORTED]: {
        avatar: {},
        walletNo: 100_000_1,
      },
      [WALLET_TYPE_WATCHING]: {
        avatar: {},
        walletNo: 100_000_2,
      },
      [WALLET_TYPE_EXTERNAL]: {
        avatar: {},
        walletNo: 100_000_3,
      },
    };
    const record: IV4DBWallet = {
      id: walletId,
      avatar: walletConfig?.[walletId]?.avatar
        ? JSON.stringify(walletConfig[walletId].avatar)
        : undefined,
      name: walletId,
      type: walletId,
      backuped: true,
      accounts: [],
      nextAccountIds: { 'global': 1 },
    };
    return record;
  }
}
