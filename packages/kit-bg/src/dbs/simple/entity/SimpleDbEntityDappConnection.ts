import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IConnectionItem,
  IConnectionProviderNames,
} from '@onekeyhq/shared/types/dappConnection';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IDappConnectionData {
  data: IConnectionItem[];
}

export class SimpleDbEntityDappConnection extends SimpleDbEntityBase<IDappConnectionData> {
  entityName = 'dappConnection';

  override enableCache = false;

  @backgroundMethod()
  async upsertConnection(newConnection: IConnectionItem) {
    await this.setRawData(({ rawData }) => {
      // Directly create new data if rawData is not initialized
      if (!rawData || !Array.isArray(rawData)) {
        return {
          data: [newConnection],
        };
      }
      const data = [...rawData.data];
      // Find the index of the connection item with the same origin
      const existingIndex = data.findIndex(
        (item) => item.origin === newConnection.origin,
      );
      // Create a new data array based on whether an existing item is found
      const newData =
        existingIndex !== -1
          ? data.map((item, index) => {
              // Update the connection item if it has the same origin
              if (index === existingIndex) {
                return {
                  ...item,
                  connectionMap: {
                    ...item.connectionMap,
                    ...newConnection.connectionMap,
                  },
                };
              }
              return item;
            })
          : [...data, newConnection]; // Add a new connection item if one with the same origin does not exist

      return { data: newData };
    });
  }

  @backgroundMethod()
  async findAccountInfoByOriginAndScope(
    origin: string,
    scope: IConnectionProviderNames,
  ) {
    const data = await this.getRawData();
    if (!data || !Array.isArray(data.data)) {
      return null;
    }

    // Find the connection item that matches the given origin
    const connectionItem = data.data.find((item) => item.origin === origin);
    if (!connectionItem) {
      return null;
    }

    const accountInfo = connectionItem.connectionMap[scope];
    return accountInfo || null;
  }
}
