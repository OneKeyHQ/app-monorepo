import Realm from 'realm';

import type { DBDevice } from '../../../types/device';

class DeviceSchema extends Realm.Object {
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
   * ble mac address
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

  public static schema: Realm.ObjectSchema = {
    name: 'Device',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      mac: 'string',
      uuid: 'string',
      deviceId: 'string',
      deviceType: 'string',
      features: 'string',
      payloadJson: 'string',
      createdAt: 'int',
      updatedAt: 'int',
    },
  };

  get internalObj(): DBDevice {
    return {
      id: this.id,
      name: this.name,
      mac: this.mac,
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

export { DeviceSchema };
