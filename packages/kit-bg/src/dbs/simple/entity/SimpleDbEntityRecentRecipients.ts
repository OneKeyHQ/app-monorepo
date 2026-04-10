import { isString } from 'lodash';

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

const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
const OLD_ENTITY_NAME = 'recentRecipients';

export class SimpleDbEntityRecentRecipients extends SimpleDbEntityBase<IRecentRecipientsDBStruct> {
  entityName = 'recentRecipientsV2';

  override enableCache = false;

  async migrateFromOldStorage(): Promise<void> {
    try {
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
          // Corrupted old data, just remove it
          await this.appStorage.removeItem(oldKey);
          return;
        }
      } else {
        const parsedObj = oldDataStr as unknown as {
          data?: IRecentRecipientsDBStruct;
        };
        oldData = parsedObj?.data;
      }

      if (!oldData?.recentRecipients) {
        await this.appStorage.removeItem(oldKey);
        return;
      }

      await this.setRawData((currentData) => {
        // Start from existing v2 data (may already have entries from new sends)
        const migratedRecipients: Record<
          string,
          Record<string, IRecentRecipientData>
        > = { ...currentData?.recentRecipients };
        const evmRecipients: Record<string, IRecentRecipientData> = {
          ...migratedRecipients.evm,
        };

        for (const [storageKey, recipients] of Object.entries(
          oldData.recentRecipients,
        )) {
          // Check if this is an EVM network key (e.g., 'evm--1', 'evm--56')
          const isEvmKey =
            storageKey === 'evm' || storageKey.startsWith('evm--');

          if (isEvmKey) {
            // Merge into shared EVM recipients, keep newer entries
            for (const [address, data] of Object.entries(recipients)) {
              // Normalize to lowercase to match updateRecentRecipients behavior
              const normalizedAddr = address.toLowerCase();
              const existing = evmRecipients[normalizedAddr];
              if (!existing || data.updatedAt > existing.updatedAt) {
                evmRecipients[normalizedAddr] = {
                  ...data,
                  networkId: data.networkId || storageKey,
                };
              }
            }
          } else {
            // Non-EVM: merge with existing, keep newer entries
            const existingNetwork = migratedRecipients[storageKey] ?? {};
            for (const [address, data] of Object.entries(recipients)) {
              const existing = existingNetwork[address];
              if (!existing || data.updatedAt > existing.updatedAt) {
                existingNetwork[address] = data;
              }
            }
            const sortedNonEvmRecipients = Object.entries(existingNetwork)
              .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
              .slice(0, 10);
            migratedRecipients[storageKey] = Object.fromEntries(
              sortedNonEvmRecipients,
            );
          }
        }

        // Add merged EVM recipients, sort and keep only top 10
        if (Object.keys(evmRecipients).length > 0) {
          const sortedEvmRecipients = Object.entries(evmRecipients)
            .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .slice(0, 10);
          migratedRecipients.evm = Object.fromEntries(sortedEvmRecipients);
        }

        return { recentRecipients: migratedRecipients };
      });

      // Remove old storage key after successful migration
      await this.appStorage.removeItem(oldKey);
    } catch (e) {
      console.error('Recent recipients migration error', e);
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
  async deleteRecentRecipient({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) {
    const storageKey =
      networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;
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
    limit = 5,
  }: {
    networkId: string;
    limit?: number;
  }): Promise<
    { address: string; updatedAt: number; networkId?: string; memo?: string }[]
  > {
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
      memo: data.memo,
    }));
  }

  @backgroundMethod()
  async updateRecentRecipients({
    networkId,
    address,
    updatedAt,
    memo,
  }: {
    networkId: string;
    address: string;
    updatedAt: number;
    memo?: string;
  }) {
    // For EVM networks, use 'evm' as the key to share recipients across all EVM chains
    const storageKey =
      networkUtils.getNetworkImplOrNetworkId({ networkId }) ?? networkId;

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
