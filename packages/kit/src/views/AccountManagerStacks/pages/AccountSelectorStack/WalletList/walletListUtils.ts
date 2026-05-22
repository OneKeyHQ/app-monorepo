import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IAccountSelectorWalletInfo } from '../../../type';

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

// Aggregate hardware-wallet vendor info for analytics user profile.
// Legacy hw wallets without `associatedDeviceInfo.vendor` are counted as
// 'onekey' (vendor is a runtime field; older device records may not have it
// populated until next connect). Returns sorted unique vendor list and the
// vendor with the most wallets (deterministic tiebreak via lexical sort).
type IHwVendorProfileWallet = Pick<IDBWallet, 'type' | 'associatedDeviceInfo'>;

export function computeHwVendorProfile(
  wallets: readonly IHwVendorProfileWallet[],
): {
  hwVendors: string[];
  primaryHwVendor: string | undefined;
} {
  const hwWallets = wallets.filter((w) => w.type === WALLET_TYPE_HW);
  if (hwWallets.length === 0) {
    return { hwVendors: [], primaryHwVendor: undefined };
  }
  const counts = hwWallets.reduce<Record<string, number>>((acc, wallet) => {
    const vendor =
      wallet.associatedDeviceInfo?.vendor ?? EHardwareVendor.onekey;
    acc[vendor] = (acc[vendor] ?? 0) + 1;
    return acc;
  }, {});
  const hwVendors = Object.keys(counts).toSorted();
  const primaryHwVendor = hwVendors.reduce((leader, v) =>
    counts[v] > counts[leader] ? v : leader,
  );
  return { hwVendors, primaryHwVendor };
}
