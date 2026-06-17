import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceScannerUtils } from './DeviceScannerUtils';

import type { SearchDevice, Success } from '@onekeyfe/hd-core';

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
}

function createScanner(searchDevices: jest.Mock) {
  return new DeviceScannerUtils({
    backgroundApi: {
      serviceHardware: {
        searchDevices,
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
});
