import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAccountSelectorWalletInfo } from '../../../type';
import type { RowModel } from '@onekeyfe/react-native-native-list';

type IBuildWalletListEntry = {
  wallet: IDBWallet;
  isBotWallet: boolean;
  isBotDeactivated: boolean;
};

function getBotWalletIndex(walletId: string): number {
  const parsedBotWalletId = accountUtils.parseBotWalletId(walletId);
  return parsedBotWalletId?.index ?? Number.MAX_SAFE_INTEGER;
}

function buildWalletListItemInfo({
  wallet,
  isBotWallet,
  isBotDeactivated,
}: IBuildWalletListEntry): IAccountSelectorWalletInfo {
  const isQrWallet = accountUtils.isQrWallet({
    walletId: wallet.id,
  });

  let badge: string | number | undefined;
  if (isQrWallet) {
    badge = 'QR';
  }

  let botStatus;
  if (isBotWallet) {
    botStatus = isBotDeactivated
      ? BOT_WALLET_STATUS_DEACTIVATED
      : BOT_WALLET_STATUS_ACTIVE;
  }

  return {
    ...wallet,
    badge,
    botStatus,
  };
}

export function getWalletChildrenLength(
  wallet: Pick<IAccountSelectorWalletInfo, 'hiddenWallets' | 'botWallets'>,
): number {
  return (wallet.hiddenWallets?.length ?? 0) + (wallet.botWallets?.length ?? 0);
}

export function findWalletListScrollTarget({
  rows,
  focusedWallet,
}: {
  rows: readonly RowModel[];
  focusedWallet: string | undefined;
}): { key: string; viewOffset: number } | undefined {
  if (!focusedWallet) {
    return undefined;
  }

  for (const row of rows) {
    if (row.type !== 'walletGroup' && row.key === focusedWallet) {
      return { key: row.key, viewOffset: 0 };
    }
    if (row.type === 'walletGroup') {
      const members = [row.parent, ...row.children];
      const focusedIndex = members.findIndex(
        (member) => member.key === focusedWallet,
      );
      if (focusedIndex >= 0) {
        const heights = members.map(
          (member) => member.height ?? (member.badges?.length ? 92 : 68),
        );
        const borderInset = row.parent.height === undefined ? 0 : 1;
        const groupHeight =
          heights.reduce((total, height) => total + height, 0) +
          row.children.length * 12 +
          borderInset * 2;
        const memberCenter =
          borderInset +
          heights
            .slice(0, focusedIndex)
            .reduce((total, height) => total + height, 0) +
          focusedIndex * 12 +
          heights[focusedIndex] / 2;

        // TODO: Clamp group alignment to the NativeList viewport height so
        // focused members stay visible when a group is taller than the viewport.
        return {
          key: row.key,
          viewOffset: groupHeight / 2 - memberCenter,
        };
      }
    }
  }

  return undefined;
}

export function buildGroupedAccountSelectorWallets(
  entries: IBuildWalletListEntry[],
): IAccountSelectorWalletInfo[] {
  const topLevelWallets: IAccountSelectorWalletInfo[] = [];
  const topLevelWalletMap = new Map<string, IAccountSelectorWalletInfo>();
  const pendingBotWalletMap = new Map<string, IAccountSelectorWalletInfo[]>();
  const orphanBotWallets: IAccountSelectorWalletInfo[] = [];

  const attachBotWalletsToParent = ({
    parentWallet,
    botWallets,
  }: {
    parentWallet: IAccountSelectorWalletInfo;
    botWallets: IAccountSelectorWalletInfo[];
  }) => {
    if (!botWallets.length) {
      return;
    }
    parentWallet.botWallets = [
      ...(parentWallet.botWallets ?? []),
      ...botWallets,
    ].toSorted((a, b) => getBotWalletIndex(a.id) - getBotWalletIndex(b.id));
  };

  entries.forEach((entry) => {
    const walletInfo = buildWalletListItemInfo(entry);

    if (!entry.isBotWallet) {
      topLevelWallets.push(walletInfo);
      topLevelWalletMap.set(walletInfo.id, walletInfo);

      if (walletInfo.isKeyless) {
        const pendingBotWallets = pendingBotWalletMap.get(walletInfo.id) ?? [];
        attachBotWalletsToParent({
          parentWallet: walletInfo,
          botWallets: pendingBotWallets,
        });
        pendingBotWalletMap.delete(walletInfo.id);
      }
      return;
    }

    const parsedBotWalletId = accountUtils.parseBotWalletId(walletInfo.id);
    const parentWalletId = parsedBotWalletId?.parentId;
    if (!parentWalletId) {
      orphanBotWallets.push(walletInfo);
      return;
    }

    const parentWallet = topLevelWalletMap.get(parentWalletId);
    if (parentWallet?.isKeyless) {
      attachBotWalletsToParent({
        parentWallet,
        botWallets: [walletInfo],
      });
      return;
    }

    const pendingBotWallets = pendingBotWalletMap.get(parentWalletId) ?? [];
    pendingBotWallets.push(walletInfo);
    pendingBotWalletMap.set(parentWalletId, pendingBotWallets);
  });

  pendingBotWalletMap.forEach((wallets) => {
    orphanBotWallets.push(...wallets);
  });

  return [...topLevelWallets, ...orphanBotWallets];
}
