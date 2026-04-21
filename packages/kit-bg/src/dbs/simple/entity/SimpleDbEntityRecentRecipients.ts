import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRecentRecipientData {
  updatedAt: number;
  networkId?: string; // The network where the last transfer occurred
  memo?: string; // Blockchain memo (Cosmos, XRP destination tag, etc.)
}

export interface IRecentRecipientsDBStruct {
  recentRecipients: Record<string, Record<string, IRecentRecipientData>>; // { storageKey: { recipient address: { updatedAt, networkId } } }
}

export interface IRecentRecipientEntry {
  address: string;
  updatedAt: number;
  networkId?: string;
  memo?: string;
}

// Per-bucket storage cap. Callers fanning out across buckets should request
// up to this many entries so the merge step has the full pool to dedupe from.
export const RECENT_RECIPIENTS_BUCKET_CAP = 10;

// Storage key uses (network, on-chain identity) so two accounts that wrap
// the same identity — e.g. the same mnemonic imported into two HD wallets —
// share a single recent-recipient list (OK-53307).
//
// EVM networkIds are collapsed to their impl (`evm--1` / `evm--56` -> `evm`)
// via networkUtils.getNetworkImplOrNetworkId before keying, so recipients stay
// shared across all EVM chains (Ethereum / BSC / Polygon / Arbitrum / ...) —
// addresses are reusable across them and users expect one recents list, not
// one per chain. Non-EVM networkIds pass through unchanged: BTC mainnet vs
// testnet, Cosmos hub vs Osmosis, etc. each keep their own bucket.
//
// buildAccountLocalAssetsKey lowercases the entire key, same as the other
// identity-keyed entities (LocalHistory / LocalTokens / LocalNFTs) — collision
// risk on case-sensitive xpubs is astronomically improbable and matches the
// existing project convention.
function buildRecipientStorageKey({
  networkId,
  accountIdentity,
}: {
  networkId: string;
  accountIdentity: string;
}): string {
  const networkImpl =
    networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;
  return accountUtils.buildAccountLocalAssetsKey({
    networkId: networkImpl,
    accountAddress: accountIdentity,
  });
}

export class SimpleDbEntityRecentRecipients extends SimpleDbEntityBase<IRecentRecipientsDBStruct> {
  entityName = 'recentRecipients';

  override enableCache = false;

  @backgroundMethod()
  async clearRecentRecipients() {
    await this.setRawData({ recentRecipients: {} });
  }

  @backgroundMethod()
  async getRecentRecipients({
    networkId,
    accountIdentity,
    limit = 5,
  }: {
    networkId: string;
    accountIdentity: string;
    limit?: number;
  }): Promise<IRecentRecipientEntry[]> {
    const rawData = await this.getRawData();
    const recentRecipients = rawData?.recentRecipients ?? {};

    const storageKey = buildRecipientStorageKey({ networkId, accountIdentity });
    const recipients = recentRecipients[storageKey] ?? {};

    const recentRecipientsSorted = Object.entries(recipients).toSorted(
      ([, { updatedAt: timestampA }], [, { updatedAt: timestampB }]) =>
        Number(timestampB) - Number(timestampA),
    );

    return recentRecipientsSorted.slice(0, limit).map(([address, data]) => ({
      address,
      updatedAt: data.updatedAt,
      networkId: data.networkId,
      memo: data.memo,
    }));
  }

  @backgroundMethod()
  async updateRecentRecipients({
    networkId,
    accountIdentity,
    address,
    updatedAt,
    memo,
  }: {
    networkId: string;
    accountIdentity: string;
    address: string;
    updatedAt: number;
    memo?: string;
  }) {
    const storageKey = buildRecipientStorageKey({ networkId, accountIdentity });

    await this.setRawData((rawData) => {
      const recentRecipients = rawData?.recentRecipients ?? {};
      const networkRecipients = recentRecipients[storageKey] ?? {};

      // Normalize EVM addresses to lowercase to avoid duplicates from checksum variants
      const normalizedAddress = networkUtils.isEvmNetwork({ networkId })
        ? address.toLowerCase()
        : address;

      // Add or update current address with the actual networkId for display
      networkRecipients[normalizedAddress] = {
        updatedAt,
        networkId, // Store the actual network where transfer occurred
        memo,
      };

      // Get all recipients for this network sorted by updatedAt, capped at
      // RECENT_RECIPIENTS_BUCKET_CAP per (network, identity) bucket.
      const sortedRecipients = Object.entries(networkRecipients)
        .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, RECENT_RECIPIENTS_BUCKET_CAP);

      // Reconstruct the network recipients object
      recentRecipients[storageKey] = Object.fromEntries(sortedRecipients);

      return { recentRecipients };
    });
  }
}
