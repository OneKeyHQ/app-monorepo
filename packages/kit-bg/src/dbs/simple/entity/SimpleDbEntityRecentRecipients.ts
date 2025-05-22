import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRecentRecipientsDBStruct {
  recentRecipients: Record<string, Record<string, { updatedAt: number }>>; // { networkId: { recipient address: { updatedAt: number } } }
}

export class SimpleDbEntityRecentRecipients extends SimpleDbEntityBase<IRecentRecipientsDBStruct> {
  entityName = 'recentRecipients';

  override enableCache = false;

  @backgroundMethod()
  async getRecentRecipientsMap() {
    const rawData = await this.getRawData();
    return rawData?.recentRecipients ?? {};
  }

  @backgroundMethod()
  async clearRecentRecipients() {
    await this.setRawData({ recentRecipients: {} });
  }

  @backgroundMethod()
  async deleteRecentRecipient({ recipientId }: { recipientId: string }) {
    await this.setRawData((rawData) => {
      const recentRecipients = rawData?.recentRecipients ?? {};
      delete recentRecipients[recipientId];
      return { recentRecipients };
    });
  }

  @backgroundMethod()
  async getRecentRecipients({
    networkId,
    limit = 5,
  }: {
    networkId: string;
    limit?: number;
  }) {
    const rawData = await this.getRawData();
    const recentRecipients = rawData?.recentRecipients ?? {};
    const recentRecipientsByNetwork = recentRecipients[networkId] ?? {};
    const recentRecipientsSorted = Object.entries(
      recentRecipientsByNetwork,
    ).sort(
      ([, { updatedAt: timestampA }], [, { updatedAt: timestampB }]) =>
        Number(timestampB) - Number(timestampA),
    );

    return recentRecipientsSorted
      .slice(0, limit)
      .map(([recipientId]) => recipientId);
  }

  @backgroundMethod()
  async updateRecentRecipients({
    networkId,
    address,
    updatedAt,
  }: {
    networkId: string;
    address: string;
    updatedAt: number;
  }) {
    await this.setRawData((rawData) => {
      const recentRecipients = rawData?.recentRecipients ?? {};
      const networkRecipients = recentRecipients[networkId] ?? {};

      // Add or update current address
      networkRecipients[address] = {
        updatedAt,
      };

      // Get all recipients for this network sorted by updatedAt
      const sortedRecipients = Object.entries(networkRecipients)
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, 10); // Keep only the 10 most recent recipients

      // Reconstruct the network recipients object
      recentRecipients[networkId] = Object.fromEntries(sortedRecipients);

      return { recentRecipients };
    });
  }
}
