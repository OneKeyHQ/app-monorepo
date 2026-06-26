import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Max number of locally-kept "Recent checks". Local device only, never synced.
const RECENT_CHECKS_CAP = 50;

export interface IAddressRiskCheckDBStruct {
  recentChecks: Record<string, IAddressRiskCheckRecentItem>;
}

function compareByCheckedAtDesc(
  a: IAddressRiskCheckRecentItem,
  b: IAddressRiskCheckRecentItem,
) {
  const checkedAtDiff = b.checkedAt - a.checkedAt;
  if (checkedAtDiff !== 0) {
    return checkedAtDiff;
  }
  return b.updatedAt - a.updatedAt;
}

function buildKey({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  // EVM addresses are case-insensitive (checksum casing is cosmetic), so
  // normalize them to dedupe re-checks of the same address. Other chains
  // (Solana, Tron, Cardano, …) are case-sensitive — keep the original casing.
  const normalizedAddress = networkUtils.isEvmNetwork({ networkId })
    ? address.toLowerCase()
    : address;
  return `${networkId}_${normalizedAddress}`;
}

export class SimpleDbEntityAddressRiskCheck extends SimpleDbEntityBase<IAddressRiskCheckDBStruct> {
  entityName = 'addressRiskCheck';

  override enableCache = false;

  @backgroundMethod()
  async getRecentChecks({
    limit = RECENT_CHECKS_CAP,
  }: { limit?: number } = {}): Promise<IAddressRiskCheckRecentItem[]> {
    const rawData = await this.getRawData();
    const recentChecks = rawData?.recentChecks ?? {};
    return Object.values(recentChecks)
      .toSorted(compareByCheckedAtDesc)
      .slice(0, limit);
  }

  @backgroundMethod()
  async addCheck(item: Omit<IAddressRiskCheckRecentItem, 'updatedAt'>) {
    // Stamp the local write time for deterministic tie-breaking and migration
    // compatibility. The list is primarily ordered by the server check time.
    const record: IAddressRiskCheckRecentItem = {
      ...item,
      updatedAt: Date.now(),
    };
    await this.setRawData((rawData) => {
      const recentChecks = rawData?.recentChecks ?? {};
      recentChecks[buildKey(record)] = record;
      // Trim to the most recent N records by the displayed server check time.
      const trimmed = Object.entries(recentChecks)
        .toSorted(([, a], [, b]) => compareByCheckedAtDesc(a, b))
        .slice(0, RECENT_CHECKS_CAP);
      return { recentChecks: Object.fromEntries(trimmed) };
    });
  }

  @backgroundMethod()
  async deleteCheck({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) {
    await this.setRawData((rawData) => {
      const recentChecks = rawData?.recentChecks ?? {};
      delete recentChecks[buildKey({ networkId, address })];
      return { recentChecks };
    });
  }

  @backgroundMethod()
  async clearChecks() {
    await this.setRawData({ recentChecks: {} });
  }
}
