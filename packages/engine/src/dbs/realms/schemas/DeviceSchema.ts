import Realm from 'realm';

import { Device } from '../../../types/device';

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
      features: 'string',
      createdAt: 'int',
      updatedAt: 'int',
    },
  };

  get internalObj(): Device {
    return {
      id: this.id,
      name: this.name,
      mac: this.mac,
      features: this.features,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export { DeviceSchema };
