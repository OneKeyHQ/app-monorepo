import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { HardwareConnectionManager } from './HardwareConnectionManager';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

describe('HardwareConnectionManager experimental Android USB transport', () => {
  afterEach(() => {
    HardwareConnectionManager.resetInstance();
  });

  it('drops a stale runtime NativeUsb once the gated setting resolves to BLE', async () => {
    const getHardwareTransportType = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.NativeUsb);
    const manager = HardwareConnectionManager.getInstance({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType,
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });

    await manager.setCurrentTransportType(EHardwareTransportType.NativeUsb);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // Dev mode or the USB dev setting was turned off.
    getHardwareTransportType.mockResolvedValue(EHardwareTransportType.BLE);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );
  });
});
