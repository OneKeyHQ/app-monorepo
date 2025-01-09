import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBDevice } from '../../v4localDBTypes';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type Realm from 'realm';

class V4RealmSchemaDevice extends V4RealmObjectBase<IV4DBDevice> {
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
  public mac!: string;

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
  public deviceType!: IDeviceType;

  /**
   * device config
   */
  // public settingsRaw!: string;
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
    name: EV4LocalDBStoreNames.Device,
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      mac: 'string', // connectId
      uuid: 'string',
      deviceId: 'string',
      deviceType: 'string',
      features: 'string',
      payloadJson: 'string', // settingsRaw
      createdAt: 'int',
      updatedAt: 'int',
    },
  };

  // TODO rename record()
  get record(): IV4DBDevice {
    return {
      id: this.id,
      name: this.name,
      mac: this.mac, // connectId
      uuid: this.uuid,
      deviceId: this.deviceId,
      deviceType: this.deviceType,
      features: this.features,
      payloadJson: this.payloadJson, // settingsRaw
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export { V4RealmSchemaDevice };
