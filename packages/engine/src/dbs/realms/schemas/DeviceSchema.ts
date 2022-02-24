import Realm from 'realm';

class DeviceSchema extends Realm.Object {
  /**
   * The device's unique identifier. eg: ble(mac-address), usb(path).
   */
  public id!: string;

  /**
   * date of the device bonded with the host device.
   */
  public addedTime!: Date;

  /**
   * date of the last time the device connect to host device.
   */
  public updateTime!: Date;

  /**
   * ble name
   */
  public name!: string;

  /**
   * the features of the device
   */
  public details!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'Device',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      details: 'string',
      addedTime: 'date',
      updateTime: 'date',
    },
  };
}

export { DeviceSchema };
