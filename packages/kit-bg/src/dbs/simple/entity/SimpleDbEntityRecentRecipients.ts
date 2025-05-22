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
      recentRecipients[networkId] = {
        ...recentRecipients[networkId],
        [address]: {
          updatedAt,
        },
      };
      return { recentRecipients };
    });
  }
}
