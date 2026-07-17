import { getPro2DeviceInfoDisplayFields } from './pro2DeviceInfo';

describe('getPro2DeviceInfoDisplayFields', () => {
  it('reads static about-device fields from Protocol V2 DeviceInfo', () => {
    expect(
      getPro2DeviceInfoDisplayFields({
        protocol_version: 1,
        hw: {
          serial_no: 'PRO2_SERIAL',
        },
        fw: {
          bootloader: { version: '1.0.0' },
          application: { version: '2.0.0' },
        },
        coprocessor: {
          application: { version: '3.0.0' },
          bt_adv_name: 'Pro2 FDD5',
        },
      }),
    ).toEqual({
      serialNumber: 'PRO2_SERIAL',
      firmwareVersion: '2.0.0',
      bootloaderVersion: '1.0.0',
      bleVersion: '3.0.0',
      bleName: 'Pro2 FDD5',
    });
  });
});
