import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAnalyticsUserProfile } from '@onekeyhq/shared/src/analytics/type';
import { WALLET_TYPE_HW } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IBotWalletMetadataMap } from '@onekeyhq/shared/types/botWallet';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

type IHwVendorProfileWallet = Pick<IDBWallet, 'type' | 'associatedDeviceInfo'>;

export const WALLET_PROFILE_ANALYTICS_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function shouldReportAnalyticsWalletProfile({
  lastReportedAt,
  now,
}: {
  lastReportedAt: number | undefined;
  now: number;
}) {
  return (
    lastReportedAt === undefined ||
    now - lastReportedAt >= WALLET_PROFILE_ANALYTICS_INTERVAL_MS
  );
}

export function computeHwVendorProfile(
  wallets: readonly IHwVendorProfileWallet[],
): {
  hwVendors: string[];
  primaryHwVendor: string | undefined;
} {
  const hwWallets = wallets.filter((wallet) => wallet.type === WALLET_TYPE_HW);
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
  const primaryHwVendor = hwVendors.reduce((leader, vendor) =>
    counts[vendor] > counts[leader] ? vendor : leader,
  );
  return { hwVendors, primaryHwVendor };
}

export function buildAnalyticsWalletProfile({
  wallets,
  botWalletMetadata,
}: {
  wallets: readonly IDBWallet[];
  botWalletMetadata: IBotWalletMetadataMap;
}): IAnalyticsUserProfile | undefined {
  const visibleWallets = wallets.filter((wallet) => {
    if (!accountUtils.isBotWallet({ walletId: wallet.id })) {
      return true;
    }
    return botWalletMetadata[wallet.id]?.visible === true;
  });
  const walletCount = visibleWallets.length;
  if (walletCount === 0) {
    return undefined;
  }

  const hwWalletCount = visibleWallets.filter(
    (wallet) => wallet.type === WALLET_TYPE_HW,
  ).length;
  const visibleWalletMap = new Map(
    visibleWallets.map((wallet) => [wallet.id, wallet]),
  );
  const keylessWalletCount = visibleWallets.filter((wallet) => {
    if (!wallet.isKeyless) {
      return false;
    }
    const parentWalletId = accountUtils.parseBotWalletId(wallet.id)?.parentId;
    return !parentWalletId || !visibleWalletMap.get(parentWalletId)?.isKeyless;
  }).length;
  const { hwVendors, primaryHwVendor } = computeHwVendorProfile(visibleWallets);

  return {
    walletCount,
    hwWalletCount,
    appWalletCount: walletCount - hwWalletCount,
    keylessWalletCount,
    hwVendors,
    primaryHwVendor,
  };
}
