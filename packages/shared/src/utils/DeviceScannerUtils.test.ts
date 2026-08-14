import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
  BluetoothUnavailableWhileUsbConnectedError,
} from '../errors/errors/hardwareErrors';

import { DeviceScannerUtils } from './DeviceScannerUtils';

import type { SearchDevice, Success, Unsuccessful } from '@onekeyfe/hd-core';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createScanner(
  searchDevices: jest.Mock,
  stopDeviceScan?: jest.Mock<Promise<void>, []>,
) {
  return new DeviceScannerUtils({
    backgroundApi: {
      serviceHardware: {
        searchDevices,
        ...(stopDeviceScan ? { stopDeviceScan } : {}),
      },
    },
  });
}

function successResponse(label: string): Success<SearchDevice[]> {
  return {
    success: true,
    payload: [
      {
        connectId: label,
        deviceId: label,
        name: label,
        uuid: label,
      } as SearchDevice,
    ],
  };
}

describe('DeviceScannerUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not block the same vendor search from another scanner instance', async () => {
    const firstSearch = createDeferred<Success<SearchDevice[]>>();
    const secondSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest
      .fn()
      .mockReturnValueOnce(firstSearch.promise)
      .mockReturnValueOnce(secondSearch.promise);
    const scannerA = createScanner(searchDevices);
    const scannerB = createScanner(searchDevices);
    const callbackA = jest.fn();
    const callbackB = jest.fn();

    scannerA.startDeviceScan(
      callbackA,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true },
    );
    await flushMicrotasks();

    scannerB.startDeviceScan(
      callbackB,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true },
    );
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledTimes(2);

    const firstResponse = successResponse('trezor-first');
    const secondResponse = successResponse('trezor-second');
    secondSearch.resolve(secondResponse);
    await flushMicrotasks();

    expect(callbackA).not.toHaveBeenCalled();
    expect(callbackB).toHaveBeenCalledWith(secondResponse);

    firstSearch.resolve(firstResponse);
    await flushMicrotasks();

    expect(callbackA).toHaveBeenCalledWith(firstResponse);

    scannerA.stopScan();
    scannerB.stopScan();
  });

  it('shares an in-flight search inside the same scanner instance', async () => {
    const firstSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest.fn(() => firstSearch.promise);
    const scanner = createScanner(searchDevices);
    const callbackA = jest.fn();
    const callbackB = jest.fn();

    scanner.startDeviceScan(
      callbackA,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true },
    );
    await flushMicrotasks();

    scanner.startDeviceScan(
      callbackB,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true },
    );
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledTimes(1);

    const response = successResponse('trezor');
    firstSearch.resolve(response);
    await flushMicrotasks();

    expect(callbackA).toHaveBeenCalledWith(response);
    expect(callbackB).toHaveBeenCalledWith(response);

    scanner.stopScan();
  });

  it('does not deliver an in-flight BLE result to a new USB scan', async () => {
    const bleSearch = createDeferred<Success<SearchDevice[]>>();
    const usbSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest
      .fn()
      .mockReturnValueOnce(bleSearch.promise)
      .mockReturnValueOnce(usbSearch.promise);
    const scanner = createScanner(searchDevices);
    const bleCallback = jest.fn();
    const usbCallback = jest.fn();

    scanner.startDeviceScan(bleCallback, jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
      transportType: 'ble',
    });
    await flushMicrotasks();

    scanner.stopScan();
    scanner.startDeviceScan(usbCallback, jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
      transportType: 'usb',
    });
    await flushMicrotasks();

    const bleResponse = successResponse('pro2-ble');
    bleSearch.resolve(bleResponse);
    await flushMicrotasks();

    expect(bleCallback).not.toHaveBeenCalled();
    expect(usbCallback).not.toHaveBeenCalled();
    expect(searchDevices).toHaveBeenCalledTimes(2);

    const usbResponse = successResponse('pro2-usb');
    usbSearch.resolve(usbResponse);
    await flushMicrotasks();

    expect(usbCallback).toHaveBeenCalledWith(usbResponse);
    scanner.stopScan();
  });

  it('does not attribute a stopped BLE rejection to a new USB scan', async () => {
    const bleSearch = createDeferred<Success<SearchDevice[]>>();
    const usbSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest
      .fn()
      .mockReturnValueOnce(bleSearch.promise)
      .mockReturnValueOnce(usbSearch.promise);
    const scanner = createScanner(searchDevices);
    const bleCallback = jest.fn();
    const usbCallback = jest.fn();
    const bleOnError = jest.fn();
    const usbOnError = jest.fn();

    scanner.startDeviceScan(bleCallback, jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
      transportType: 'ble',
      onError: bleOnError,
    });
    await flushMicrotasks();

    scanner.stopScan();
    scanner.startDeviceScan(usbCallback, jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
      transportType: 'usb',
      onError: usbOnError,
    });
    await flushMicrotasks();

    bleSearch.reject(new Error('stale BLE search failed'));
    await flushMicrotasks();

    expect(bleCallback).not.toHaveBeenCalled();
    expect(bleOnError).not.toHaveBeenCalled();
    expect(usbOnError).not.toHaveBeenCalled();
    expect(searchDevices).toHaveBeenCalledTimes(2);

    const usbResponse = successResponse('pro2-usb');
    usbSearch.resolve(usbResponse);
    await flushMicrotasks();

    expect(usbCallback).toHaveBeenCalledWith(usbResponse);
    scanner.stopScan();
  });

  it('does not attribute a stopped BLE rejection to a restarted BLE scan', async () => {
    const staleBleSearch = createDeferred<Success<SearchDevice[]>>();
    const currentBleSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest
      .fn()
      .mockReturnValueOnce(staleBleSearch.promise)
      .mockReturnValueOnce(currentBleSearch.promise);
    const scanner = createScanner(searchDevices);
    const staleCallback = jest.fn();
    const currentCallback = jest.fn();
    const staleOnError = jest.fn();
    const currentOnError = jest.fn();

    scanner.startDeviceScan(staleCallback, jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
      transportType: 'ble',
      onError: staleOnError,
    });
    await flushMicrotasks();

    scanner.stopScan();
    scanner.startDeviceScan(
      currentCallback,
      jest.fn(),
      1,
      60_000,
      1,
      undefined,
      {
        connectProtocol: 'V2',
        transportType: 'ble',
        onError: currentOnError,
      },
    );
    await flushMicrotasks();

    staleBleSearch.reject(new Error('stale BLE search failed'));
    await flushMicrotasks();

    expect(staleCallback).not.toHaveBeenCalled();
    expect(staleOnError).not.toHaveBeenCalled();
    expect(currentOnError).not.toHaveBeenCalled();
    expect(searchDevices).toHaveBeenCalledTimes(2);

    const currentResponse = successResponse('pro2-current-ble');
    currentBleSearch.resolve(currentResponse);
    await flushMicrotasks();

    expect(currentCallback).toHaveBeenCalledWith(currentResponse);
    scanner.stopScan();
  });

  it('keeps resetSession when a stopped scan resolves before the restarted scan begins', async () => {
    const staleBleSearch = createDeferred<Success<SearchDevice[]>>();
    const currentBleSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest
      .fn()
      .mockReturnValueOnce(staleBleSearch.promise)
      .mockReturnValueOnce(currentBleSearch.promise);
    const scanner = createScanner(searchDevices);
    const staleCallback = jest.fn();
    const currentCallback = jest.fn();

    scanner.startDeviceScan(
      staleCallback,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      {
        resetSession: true,
        transportType: 'ble',
      },
    );
    await flushMicrotasks();

    scanner.stopScan();
    scanner.startDeviceScan(
      currentCallback,
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      {
        resetSession: true,
        transportType: 'ble',
      },
    );
    await flushMicrotasks();

    staleBleSearch.resolve(successResponse('stale-trezor-ble'));
    await flushMicrotasks();

    expect(staleCallback).not.toHaveBeenCalled();
    expect(searchDevices).toHaveBeenCalledTimes(2);
    expect(searchDevices).toHaveBeenNthCalledWith(2, {
      resetSession: true,
      transportType: 'ble',
      vendor: EHardwareVendor.trezor,
    });

    const currentResponse = successResponse('current-trezor-ble');
    currentBleSearch.resolve(currentResponse);
    await flushMicrotasks();

    expect(currentCallback).toHaveBeenCalledWith(currentResponse);
    scanner.stopScan();
  });

  it('does not block a different vendor search behind an in-flight search', async () => {
    const trezorSearch = createDeferred<Success<SearchDevice[]>>();
    const ledgerSearch = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest.fn((params?: { vendor?: EHardwareVendor }) => {
      if (params?.vendor === EHardwareVendor.ledger) {
        return ledgerSearch.promise;
      }
      return trezorSearch.promise;
    });
    const scannerA = createScanner(searchDevices);
    const scannerB = createScanner(searchDevices);

    scannerA.startDeviceScan(
      jest.fn(),
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true },
    );
    await flushMicrotasks();

    scannerB.startDeviceScan(
      jest.fn(),
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.ledger,
      { resetSession: true },
    );
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledTimes(2);
    expect(searchDevices).toHaveBeenNthCalledWith(1, {
      vendor: EHardwareVendor.trezor,
      resetSession: true,
    });
    expect(searchDevices).toHaveBeenNthCalledWith(2, {
      vendor: EHardwareVendor.ledger,
      resetSession: true,
    });

    trezorSearch.resolve(successResponse('trezor'));
    ledgerSearch.resolve(successResponse('ledger'));
    await flushMicrotasks();

    scannerA.stopScan();
    scannerB.stopScan();
  });

  it('passes waitForAllTransports to hardware search when requested', async () => {
    const search = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest.fn(() => search.promise);
    const scanner = createScanner(searchDevices);

    scanner.startDeviceScan(
      jest.fn(),
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true, waitForAllTransports: true },
    );
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledWith({
      vendor: EHardwareVendor.trezor,
      resetSession: true,
      waitForAllTransports: true,
    });

    search.resolve(successResponse('trezor'));
    await flushMicrotasks();
    scanner.stopScan();
  });

  it('passes transportType to hardware search when requested', async () => {
    const search = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest.fn(() => search.promise);
    const scanner = createScanner(searchDevices);

    scanner.startDeviceScan(
      jest.fn(),
      jest.fn(),
      1,
      60_000,
      1,
      EHardwareVendor.trezor,
      { resetSession: true, transportType: 'ble' },
    );
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledWith({
      vendor: EHardwareVendor.trezor,
      resetSession: true,
      waitForAllTransports: undefined,
      transportType: 'ble',
    });

    search.resolve(successResponse('trezor'));
    await flushMicrotasks();
    scanner.stopScan();
  });

  it('ignores an explicit protocol hint during OneKey device search', async () => {
    const search = createDeferred<Success<SearchDevice[]>>();
    const searchDevices = jest.fn(() => search.promise);
    const scanner = createScanner(searchDevices);

    scanner.startDeviceScan(jest.fn(), jest.fn(), 1, 60_000, 1, undefined, {
      connectProtocol: 'V2',
    });
    await flushMicrotasks();

    expect(searchDevices).toHaveBeenCalledWith(undefined);

    search.resolve(successResponse('pro2'));
    await flushMicrotasks();
    scanner.stopScan();
  });

  it('routes unsuccessful responses through the normalized error handler', async () => {
    const search = createDeferred<Unsuccessful>();
    const searchDevices = jest.fn(() => search.promise);
    const scanner = createScanner(searchDevices);
    const callback = jest.fn();
    const onError = jest.fn();

    scanner.startDeviceScan(callback, jest.fn(), 1, 60_000, 1, undefined, {
      onError,
    });
    await flushMicrotasks();

    search.resolve({
      success: false,
      payload: {
        code: BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
        error: 'Bluetooth is unavailable while USB is connected',
      },
    });
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(
      BluetoothUnavailableWhileUsbConnectedError,
    );
    scanner.stopScan();
  });

  it('reports rejected searches and stops polling', async () => {
    const searchError = new Error('search transport unavailable');
    const searchDevices = jest.fn().mockRejectedValue(searchError);
    const scanner = createScanner(searchDevices);
    const onError = jest.fn();
    const onSearchStateChange = jest.fn();

    scanner.startDeviceScan(
      jest.fn(),
      onSearchStateChange,
      1,
      60_000,
      1,
      undefined,
      { onError },
    );
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(searchError);
    expect(onSearchStateChange).toHaveBeenLastCalledWith('stop');
    expect(Object.values(scanner.scanMap).every((value) => !value)).toBe(true);
  });

  it('waits for the active search and Noble scan cleanup before stopping', async () => {
    const search = createDeferred<Success<SearchDevice[]>>();
    const nobleStop = createDeferred<void>();
    const searchDevices = jest.fn(() => search.promise);
    const stopDeviceScan = jest.fn(() => nobleStop.promise);
    const scanner = createScanner(searchDevices, stopDeviceScan);
    const stopped = jest.fn();

    scanner.startDeviceScan(jest.fn(), jest.fn(), 1, 60_000, 1);
    await flushMicrotasks();

    const stopPromise = scanner.stopScanAndWait().then(stopped);
    await flushMicrotasks();

    expect(stopDeviceScan).not.toHaveBeenCalled();
    expect(stopped).not.toHaveBeenCalled();

    search.resolve(successResponse('pro2'));
    await flushMicrotasks();

    expect(stopDeviceScan).toHaveBeenCalledTimes(1);
    expect(stopped).not.toHaveBeenCalled();

    nobleStop.resolve(undefined);
    await stopPromise;

    expect(stopped).toHaveBeenCalledTimes(1);
  });
});
