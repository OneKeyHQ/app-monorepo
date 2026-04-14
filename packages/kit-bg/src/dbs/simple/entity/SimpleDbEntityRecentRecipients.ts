import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
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

function buildRecipientStorageKey({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}): string {
  const networkKey =
    networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;
  return `${networkKey}__${accountId}`;
}

export class SimpleDbEntityRecentRecipients extends SimpleDbEntityBase<IRecentRecipientsDBStruct> {
  entityName = 'recentRecipients';

  override enableCache = false;

  @backgroundMethod()
  async clearRecentRecipients() {
    await this.setRawData({ recentRecipients: {} });
  }

  @backgroundMethod()
  async deleteRecentRecipient({
    networkId,
    accountId,
    address,
  }: {
    networkId: string;
    accountId: string;
    address: string;
  }) {
    const storageKey = buildRecipientStorageKey({ networkId, accountId });
    await this.setRawData((rawData) => {
      const recentRecipients = rawData?.recentRecipients ?? {};
      const networkRecipients = recentRecipients[storageKey];
      if (networkRecipients) {
        const normalizedAddress = networkUtils.isEvmNetwork({ networkId })
          ? address.toLowerCase()
          : address;
        delete networkRecipients[normalizedAddress];
      }
      return { recentRecipients };
    });
  }

  @backgroundMethod()
  async getRecentRecipients({
    networkId,
    accountId,
    limit = 5,
  }: {
    networkId: string;
    accountId: string;
    limit?: number;
  }): Promise<
    { address: string; updatedAt: number; networkId?: string; memo?: string }[]
  > {
    const rawData = await this.getRawData();
    const recentRecipients = rawData?.recentRecipients ?? {};

    const storageKey = buildRecipientStorageKey({ networkId, accountId });
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
    accountId,
    address,
    updatedAt,
    memo,
  }: {
    networkId: string;
    accountId: string;
    address: string;
    updatedAt: number;
    memo?: string;
  }) {
    const storageKey = buildRecipientStorageKey({ networkId, accountId });

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

      // Get all recipients for this network sorted by updatedAt
      const sortedRecipients = Object.entries(networkRecipients)
        .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, 10); // Keep only the 10 most recent recipients

      // Reconstruct the network recipients object
      recentRecipients[storageKey] = Object.fromEntries(sortedRecipients);

      return { recentRecipients };
    });
  }
}
