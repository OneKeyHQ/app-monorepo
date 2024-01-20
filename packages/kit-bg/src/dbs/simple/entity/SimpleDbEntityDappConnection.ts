import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IConnectionItem } from '@onekeyhq/shared/types/dappConnection';

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
      // 如果 rawData 未初始化，则直接创建新的数据
      if (!rawData || !Array.isArray(rawData)) {
        return {
          data: [newConnection],
        };
      }
      const data = [...rawData.data];
      // 查找是否存在相同 origin 的连接项
      const existingIndex = data.findIndex(
        (item) => item.origin === newConnection.origin,
      );
      // 根据是否找到现有项来创建新的数据数组
      const newData =
        existingIndex !== -1
          ? data.map((item, index) => {
              // 如果存在相同 origin 的连接项，则更新它
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
          : [...data, newConnection]; // 如果不存在相同 origin 的连接项，则创建新的连接项

      return { data: newData };
    });
  }
}
