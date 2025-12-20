import { cloneDeep } from 'lodash';

import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ICloudSyncPayloadAddressBook,
  ICloudSyncTargetAddressBook,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBCloudSyncItem, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerAddressBook extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.AddressBook,
  IAddressItem
> {
  override dataType = EPrimeCloudSyncDataType.AddressBook as any;

  override removeSyncItemIfServerDeleted = true;

  override async buildSyncRawKey(params: {
    target: ICloudSyncTargetAddressBook;
  }): Promise<string> {
    const { address, networkId } = params.target.addressBookItem;
    const networkImpl = networkUtils.getNetworkImplOrNetworkId({
      networkId,
    });

    return Promise.resolve(
      [
        networkImpl || 'unknown-network',
        `address:${address?.toLowerCase()}`,
      ].join('__'),
    );
  }

  override async buildSyncPayload({
    target,
    _callerName,
  }: {
    target: ICloudSyncTargetAddressBook;
    _callerName?: string;
  }): Promise<ICloudSyncPayloadAddressBook> {
    const { addressBookItem } = target;
    const networkImpl: string = networkUtils.getNetworkImpl({
      networkId: addressBookItem.networkId,
    });
    return Promise.resolve({
      networkImpl,
      addressBookItem: {
        ...cloneDeep(addressBookItem),
        id: '', // id is local uuid, should not be sync
      },
    });
  }

  override async isSupportSync(
    _target: ICloudSyncTargetAddressBook,
  ): Promise<boolean> {
    return true;
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetAddressBook;
    payload: ICloudSyncPayloadAddressBook;
  }): Promise<boolean> {
    const { payload, item } = params;

    const password =
      await this.backgroundApi.servicePassword.getCachedPassword();
    if (!password) {
      return false;
    }

    const existingAddressBookItem =
      await this.backgroundApi.serviceAddressBook.findItem({
        networkImpl: payload.networkImpl,
        address: payload.addressBookItem.address,
        password,
      });

    if (item.isDeleted) {
      if (existingAddressBookItem && password) {
        await this.backgroundApi.serviceAddressBook.removeItemFn(
          existingAddressBookItem,
          {
            password,
            // avoid infinite loop sync
            skipSaveLocalSyncItem: true,
            skipEventEmit: true,
          },
        );
      }
    } else {
      if (existingAddressBookItem && password) {
        await this.backgroundApi.serviceAddressBook.updateItemFn(
          {
            ...existingAddressBookItem,
            ...payload.addressBookItem,
            id: existingAddressBookItem.id,
          },
          {
            password,
            // avoid infinite loop sync
            skipSaveLocalSyncItem: true,
            skipEventEmit: true,
          },
        );
      }
      if (!existingAddressBookItem && password) {
        await this.backgroundApi.serviceAddressBook.addItemFn(
          payload.addressBookItem,
          {
            password,
            // avoid infinite loop sync
            skipSaveLocalSyncItem: true,
            skipEventEmit: true,
          },
        );
      }
    }

    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadAddressBook;
  }): Promise<IAddressItem | undefined> {
    const { payload } = params;
    const password =
      await this.backgroundApi.servicePassword.getCachedPassword();
    if (!password) {
      return undefined;
    }
    const item = await this.backgroundApi.serviceAddressBook.findItem({
      networkImpl: payload.networkImpl,
      address: payload.addressBookItem.address,
      password,
    });
    return cloneDeep(item);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IAddressItem;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetAddressBook> {
    return {
      targetId: params.dbRecord.id || '',
      dataType: EPrimeCloudSyncDataType.AddressBook,
      addressBookItem: cloneDeep(params.dbRecord),
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadAddressBook;
  }): Promise<ICloudSyncTargetAddressBook | undefined> {
    const { payload } = params;

    return {
      targetId: '', // id is local uuid, should not be sync
      dataType: EPrimeCloudSyncDataType.AddressBook,
      addressBookItem: {
        ...cloneDeep(payload.addressBookItem),
        id: '', // id is local uuid, should not be sync
      },
    };
  }
}
