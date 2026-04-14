import { BOT_WALLET_ID_PREFIX } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IBotWalletMetadata,
  IBotWalletMetadataMap,
} from '@onekeyhq/shared/types/botWallet';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Keyed by walletId → metadata. Source of truth is cloud sync; this is local cache.
export class SimpleDbEntityBotWallet extends SimpleDbEntityBase<IBotWalletMetadataMap> {
  entityName = 'botWallet';

  override enableCache = false;

  async getMetadataMap(): Promise<IBotWalletMetadataMap> {
    return (await this.getRawData()) ?? {};
  }

  async getMetadata(walletId: string): Promise<IBotWalletMetadata | undefined> {
    const map = await this.getMetadataMap();
    return map[walletId];
  }

  async setMetadata(
    walletId: string,
    metadata: IBotWalletMetadata,
  ): Promise<void> {
    const map = await this.getMetadataMap();
    map[walletId] = metadata;
    await this.setRawData(map);
  }

  async removeMetadata(walletId: string): Promise<void> {
    const map = await this.getMetadataMap();
    delete map[walletId];
    await this.setRawData(map);
  }

  async getNextIndex(parentKeylessWalletId: string): Promise<number> {
    const map = await this.getMetadataMap();
    const prefix = `${BOT_WALLET_ID_PREFIX}${parentKeylessWalletId}--`;
    const usedIndexes = new Set<number>();

    for (const key of Object.keys(map)) {
      if (key.startsWith(prefix)) {
        const index = map[key]?.index;
        if (Number.isInteger(index) && Number(index) >= 0) {
          usedIndexes.add(Number(index));
        }
      }
    }

    let nextIndex = 0;
    while (usedIndexes.has(nextIndex)) {
      nextIndex += 1;
    }

    return nextIndex;
  }

  async getBotWalletsForParent(
    parentKeylessWalletId: string,
  ): Promise<Array<{ walletId: string; metadata: IBotWalletMetadata }>> {
    const map = await this.getMetadataMap();
    const prefix = `${BOT_WALLET_ID_PREFIX}${parentKeylessWalletId}--`;
    const results: Array<{ walletId: string; metadata: IBotWalletMetadata }> =
      [];
    for (const [walletId, metadata] of Object.entries(map)) {
      if (walletId.startsWith(prefix)) {
        results.push({ walletId, metadata });
      }
    }
    return results.toSorted((a, b) => a.metadata.index - b.metadata.index);
  }

  async bulkSetMetadata(entries: IBotWalletMetadataMap): Promise<void> {
    const map = await this.getMetadataMap();
    Object.assign(map, entries);
    await this.setRawData(map);
  }

  async replaceMetadataForParent(
    parentKeylessWalletId: string,
    entries: Array<{ walletId?: string; metadata: IBotWalletMetadata }>,
  ): Promise<void> {
    const map = await this.getMetadataMap();
    const prefix = `${BOT_WALLET_ID_PREFIX}${parentKeylessWalletId}--`;

    for (const walletId of Object.keys(map)) {
      if (walletId.startsWith(prefix)) {
        delete map[walletId];
      }
    }

    for (const entry of entries) {
      const walletId =
        entry.walletId ??
        accountUtils.buildBotWalletId({
          parentKeylessWalletId,
          index: entry.metadata.index,
        });
      map[walletId] = entry.metadata;
    }

    await this.setRawData(map);
  }
}
