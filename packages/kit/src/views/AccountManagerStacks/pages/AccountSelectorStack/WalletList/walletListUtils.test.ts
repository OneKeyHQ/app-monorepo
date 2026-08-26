import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { BOT_WALLET_STATUS_DEACTIVATED } from '@onekeyhq/shared/src/consts/dbConsts';

import {
  buildGroupedAccountSelectorWallets,
  getWalletChildrenLength,
} from './walletListUtils';

function createWallet({
  id,
  name,
  isKeyless = false,
  type = 'hd',
}: {
  id: string;
  name: string;
  isKeyless?: boolean;
  type?: IDBWallet['type'];
}): IDBWallet {
  return {
    id,
    name,
    type,
    isKeyless,
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
  } as IDBWallet;
}

describe('walletListUtils', () => {
  it('groups bot wallets under their parent keyless wallet', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-keyless-parent-1',
          name: 'Parent',
          isKeyless: true,
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-2',
          name: 'Wallet 2',
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
    ]);

    expect(wallets).toHaveLength(2);
    expect(wallets[0].id).toBe('hd-keyless-parent-1');
    expect(wallets[0].botWallets?.map((wallet) => wallet.id)).toEqual([
      'hd-bot--hd-keyless-parent-1--0',
    ]);
    expect(wallets[1].id).toBe('hd-2');
  });

  it('attaches bot wallets even when they appear before their parent', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--1',
          name: 'Bot #2',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-keyless-parent-1',
          name: 'Parent',
          isKeyless: true,
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
    ]);

    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe('hd-keyless-parent-1');
    expect(wallets[0].botWallets?.map((wallet) => wallet.id)).toEqual([
      'hd-bot--hd-keyless-parent-1--0',
      'hd-bot--hd-keyless-parent-1--1',
    ]);
  });

  it('keeps bot wallets at top level when the parent wallet is missing', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: true,
      },
    ]);

    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe('hd-bot--hd-keyless-parent-1--0');
    expect(wallets[0].botStatus).toBe(BOT_WALLET_STATUS_DEACTIVATED);
  });

  it('counts hidden and bot wallets together', () => {
    expect(
      getWalletChildrenLength({
        hiddenWallets: [createWallet({ id: 'hidden-1', name: 'Hidden' })],
        botWallets: [
          {
            ...createWallet({
              id: 'hd-bot--hd-keyless-parent-1--0',
              name: 'Bot #1',
            }),
          },
          {
            ...createWallet({
              id: 'hd-bot--hd-keyless-parent-1--1',
              name: 'Bot #2',
            }),
          },
        ],
      }),
    ).toBe(3);
  });
});
