import { createCombinedConnector } from '@onekeyfe/hwk-adapter-core';

import type { IConnector } from '@onekeyfe/hwk-adapter-core';

function connector(connectionType: 'usb' | 'ble') {
  return {
    connectionType,
    searchDevices: jest.fn<
      ReturnType<IConnector['searchDevices']>,
      Parameters<IConnector['searchDevices']>
    >(async () => []),
    connect: jest.fn(async () => ({
      sessionId: `${connectionType}-session`,
      deviceInfo: {
        vendor: 'ledger' as const,
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'nano',
        connectId: 'nano',
        connectionType,
      },
    })),
    disconnect: jest.fn(),
    call: jest.fn(),
    cancel: jest.fn(),
    uiResponse: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    reset: jest.fn(),
  } satisfies IConnector;
}

it('retains the BLE route after an empty scan and restores it when the device returns', async () => {
  const usb = connector('usb');
  const ble = connector('ble');
  const combined = createCombinedConnector([usb, ble]);
  const found = [
    {
      connectId: 'nano',
      deviceId: 'nano',
      name: 'Nano X',
      connectionType: 'ble' as const,
    },
  ];
  jest
    .mocked(ble.searchDevices)
    .mockResolvedValueOnce(found)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(found);
  await combined.searchDevices({ transportType: 'ble' });
  await combined.searchDevices({ transportType: 'ble' });
  jest
    .mocked(ble.connect)
    .mockRejectedValueOnce(new Error('pairing timed out'));
  await expect(combined.connect('nano')).rejects.toThrow('pairing timed out');
  await combined.searchDevices({ transportType: 'ble' });
  await expect(combined.connect('nano')).resolves.toMatchObject({
    sessionId: 'ble-session',
  });
  expect(usb.connect).not.toHaveBeenCalled();
});
