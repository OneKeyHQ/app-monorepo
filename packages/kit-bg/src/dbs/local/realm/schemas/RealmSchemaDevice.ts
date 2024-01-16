import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBDevice } from '../../types';
import type Realm from 'realm';

class RealmSchemaDevice extends RealmObjectBase<IDBDevice> {
  /**
   * The device's unique identifier.
   */
  public id!: string;

  /**
   * ble name
   */
  public name!: string;

  /**
   * the features of the device
   */
  public features!: string;

  /**
   * ble connectId address (mac)
   */
  public connectId!: string;

  /**
   * device uuid
   */
  public uuid!: string;

  /**
   * device id
   */
  public deviceId!: string;

  /**
   * device type
   */
  public deviceType!: string;

  /**
   * device config
   */
  public payloadJson!: string;

  /**
   * timestamp of the device bonded with the host device.
   */
  public createdAt!: number;

  /**
   * timestamp of the last time the device connect to host device.
   */
  public updatedAt!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Device,
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      connectId: 'string',
      uuid: 'string',
      deviceId: 'string',
      deviceType: 'string',
      features: 'string',
      payloadJson: 'string',
      createdAt: 'int',
      updatedAt: 'int',
    },
  };

  // TODO rename record()
  get record(): IDBDevice {
    return {
      id: this.id,
      name: this.name,
      connectId: this.connectId,
      uuid: this.uuid,
      deviceId: this.deviceId,
      deviceType: this.deviceType,
      features: this.features,
      payloadJson: this.payloadJson,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export { RealmSchemaDevice };
