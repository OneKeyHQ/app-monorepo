import { isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRecentRecipientData {
  updatedAt: number;
  networkId?: string; // The network where the last transfer occurred
}

export interface IRecentRecipientsDBStruct {
  recentRecipients: Record<string, Record<string, IRecentRecipientData>>; // { storageKey: { recipient address: { updatedAt, networkId } } }
}

const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
const OLD_ENTITY_NAME = 'recentRecipients';

export class SimpleDbEntityRecentRecipients extends SimpleDbEntityBase<IRecentRecipientsDBStruct> {
  entityName = 'recentRecipientsV2';

  override enableCache = false;

  private migrationDone = false;

  private async migrateFromOldStorage(): Promise<void> {
    if (this.migrationDone) {
      return;
    }
    this.migrationDone = true;

    try {
      // Check if we already have data in new storage
      const currentData = await this.getRawData();
      if (
        currentData?.recentRecipients &&
        Object.keys(currentData.recentRecipients).length > 0
      ) {
        return;
      }

      // Read from old storage key
      const oldKey = `${SIMPLE_DB_KEY_PREFIX}:${OLD_ENTITY_NAME}`;
      const oldDataStr = await this.appStorage.getItem(oldKey);

      if (!oldDataStr) {
        return;
      }

      let oldData: IRecentRecipientsDBStruct | undefined;
      if (isString(oldDataStr)) {
        try {
          const parsed = JSON.parse(oldDataStr) as {
            data?: IRecentRecipientsDBStruct;
          };
          oldData = parsed?.data;
        } catch {
          return;
        }
      } else {
        const parsedObj = oldDataStr as unknown as {
          data?: IRecentRecipientsDBStruct;
        };
        oldData = parsedObj?.data;
      }

      if (!oldData?.recentRecipients) {
        return;
      }

      // Migrate: merge all EVM network data into 'evm' key
      const migratedRecipients: Record<
        string,
        Record<string, IRecentRecipientData>
      > = {};
      const evmRecipients: Record<string, IRecentRecipientData> = {};

      for (const [storageKey, recipients] of Object.entries(
        oldData.recentRecipients,
      )) {
        // Check if this is an EVM network key (e.g., 'evm--1', 'evm--56')
        const isEvmKey = storageKey === 'evm' || storageKey.startsWith('evm--');

        if (isEvmKey) {
          // Merge into shared EVM recipients
          for (const [address, data] of Object.entries(recipients)) {
            const existing = evmRecipients[address];
            if (!existing || data.updatedAt > existing.updatedAt) {
              evmRecipients[address] = {
                ...data,
                networkId: data.networkId || storageKey,
              };
            }
          }
        } else {
          // Keep non-EVM networks as-is
          migratedRecipients[storageKey] = recipients;
        }
      }

      // Add merged EVM recipients
      if (Object.keys(evmRecipients).length > 0) {
        // Sort and keep only top 10
        const sortedEvmRecipients = Object.entries(evmRecipients)
          .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
          .slice(0, 10);
        migratedRecipients.evm = Object.fromEntries(sortedEvmRecipients);
      }

      // Save migrated data
      if (Object.keys(migratedRecipients).length > 0) {
        await this.setRawData({ recentRecipients: migratedRecipients });
      }

      // Remove old storage key after successful migration
      await this.appStorage.removeItem(oldKey);
    } catch {
      // Migration failed, ignore and continue
    }
  }

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
  }): Promise<{ address: string; updatedAt: number; networkId?: string }[]> {
    // Try to migrate from old storage on first access
    await this.migrateFromOldStorage();

    const rawData = await this.getRawData();
    const recentRecipients = rawData?.recentRecipients ?? {};

    // For EVM networks, use 'evm' as the key; for others, use networkId
    const storageKey =
      networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;
    const recipients = recentRecipients[storageKey] ?? {};

    const recentRecipientsSorted = Object.entries(recipients).toSorted(
      ([, { updatedAt: timestampA }], [, { updatedAt: timestampB }]) =>
        Number(timestampB) - Number(timestampA),
    );

    return recentRecipientsSorted.slice(0, limit).map(([address, data]) => ({
      address,
      updatedAt: data.updatedAt,
      networkId: data.networkId,
    }));
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
    // For EVM networks, use 'evm' as the key to share recipients across all EVM chains
    const storageKey =
      networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;

    await this.setRawData((rawData) => {
      const recentRecipients = rawData?.recentRecipients ?? {};
      const networkRecipients = recentRecipients[storageKey] ?? {};

      // Add or update current address with the actual networkId for display
      networkRecipients[address] = {
        updatedAt,
        networkId, // Store the actual network where transfer occurred
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
