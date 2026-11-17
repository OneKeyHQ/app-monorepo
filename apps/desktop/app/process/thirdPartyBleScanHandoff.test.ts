import { EventEmitter } from 'events';

import { NobleBleHandler } from '@onekeyfe/hwk-desktop-noble-ble';

const SERVICE = '00000000000000000000000000000001';
const WRITE = '00000000000000000000000000000002';
const NOTIFY = '00000000000000000000000000000003';

it('keeps the selected Windows peripheral while OS pairing runs without advertisements', async () => {
  jest.useFakeTimers();
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const characteristics = [WRITE, NOTIFY].map((uuid) =>
    Object.assign(new EventEmitter(), {
      uuid,
      subscribeAsync: jest.fn(async () => undefined),
      unsubscribeAsync: jest.fn(async () => undefined),
      writeAsync: jest.fn(async () => undefined),
    }),
  );
  const peripheral = Object.assign(new EventEmitter(), {
    id: 'selected-ledger',
    advertisement: { localName: 'Ledger', serviceUuids: [SERVICE] },
    rssi: -50,
    state: 'disconnected',
    connectAsync: jest.fn(async () => undefined),
    disconnectAsync: jest.fn(async () => undefined),
    discoverSomeServicesAndCharacteristicsAsync: jest.fn(async () => ({
      characteristics,
    })),
  });
  const noble = Object.assign(new EventEmitter(), {
    state: 'poweredOn',
    startScanningAsync: jest.fn(async () => undefined),
    stopScanningAsync: jest.fn(async () => undefined),
    connectAsync: jest.fn(async () => peripheral),
  });
  const handler = new NobleBleHandler({
    nobleFactory: () => noble,
    vendors: {
      ledger: {
        isServiceUuid: (uuid) => uuid === SERVICE,
        acceptsConnect: () => true,
      },
    },
  });
  try {
    await handler.scan({ vendor: 'ledger' });
    noble.emit('discover', peripheral);
    // Windows can replace a full advertisement with a name-only packet.
    peripheral.advertisement.serviceUuids = [];
    noble.emit('discover', peripheral);
    expect(
      (await handler.scan({ vendor: 'ledger' }))[0].advertisedServiceUuids,
    ).toContain(SERVICE);
    expect(handler.getDevice(peripheral.id)?.advertisedServiceUuids).toContain(
      SERVICE,
    );
    await handler.stopScan('ledger');
    expect(noble.stopScanningAsync).toHaveBeenCalledTimes(1);

    // The field log's first OS pairing took 13 seconds, without further advertisements.
    await jest.advanceTimersByTimeAsync(13_000);
    expect(handler.getDevice(peripheral.id)?.id).toBe(peripheral.id);

    const connecting = handler.connect(peripheral.id, {
      vendor: 'ledger',
      serviceUuid: SERVICE,
      writeUuid: WRITE,
      notifyUuid: NOTIFY,
      write: { mode: 'raw', maxLength: 255 },
    });
    await jest.advanceTimersByTimeAsync(300);
    await expect(connecting).resolves.toMatchObject({ id: peripheral.id });
    expect(noble.startScanningAsync).toHaveBeenCalledTimes(1);
    expect(noble.connectAsync).not.toHaveBeenCalled();
    expect(peripheral.connectAsync).toHaveBeenCalledTimes(1);

    await handler.disconnect(peripheral.id);
    peripheral.discoverSomeServicesAndCharacteristicsAsync.mockRejectedValueOnce(
      new Error('Windows GATT service discovery failed with status 3'),
    );
    const failedConnect = handler
      .connect(peripheral.id, {
        vendor: 'ledger',
        serviceUuid: SERVICE,
        writeUuid: WRITE,
        notifyUuid: NOTIFY,
        write: { mode: 'raw', maxLength: 255 },
      })
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(300);
    expect(await failedConnect).toMatchObject({
      message: 'Windows GATT service discovery failed with status 3',
    });
  } finally {
    await handler.dispose();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    jest.useRealTimers();
  }
});
