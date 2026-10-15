/* eslint-disable import/first */
import { EventEmitter } from 'events';

jest.mock('electron', () => ({ utilityProcess: { fork: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

import { utilityProcess } from 'electron';

import { ECheckBiometricAuthChangedEventType } from './enum';

const type = ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged;

describe('desktop biometric state checks', () => {
  let service: typeof import('./index');
  let child: EventEmitter & { postMessage: jest.Mock };
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    child = Object.assign(new EventEmitter(), { postMessage: jest.fn() });
    jest
      .mocked(utilityProcess)
      .fork.mockReturnValue(
        child as unknown as ReturnType<(typeof utilityProcess)['fork']>,
      );
    jest.isolateModules(() => {
      service = require('./index') as typeof import('./index');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    if (originalPlatform)
      Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('rejects when the native service is absent', async () => {
    await expect(service.checkBiometricAuthChanged()).rejects.toThrow();
  });

  it.each([false, true])(
    'preserves the successful native result %s',
    async (result) => {
      service.startServices();
      const checking = service.checkBiometricAuthChanged();
      const request = child.postMessage.mock.calls[0][0];
      child.emit('message', { type, requestId: request.requestId, result });
      await expect(checking).resolves.toBe(result);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('rejects timeout and ignores its late response during the next request', async () => {
    service.startServices();
    const first = service.checkBiometricAuthChanged();
    const failed = first.then(
      () => 'resolved',
      () => 'rejected',
    );
    const oldRequest = child.postMessage.mock.calls[0][0];
    jest.advanceTimersByTime(500);
    expect(await failed).toBe('rejected');
    const next = service.checkBiometricAuthChanged();
    const newRequest = child.postMessage.mock.calls[1][0];
    let settled = false;
    void next.then(() => {
      settled = true;
    });
    child.emit('message', {
      type,
      requestId: oldRequest.requestId,
      result: false,
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    child.emit('message', {
      type,
      requestId: newRequest.requestId,
      result: true,
    });
    await expect(next).resolves.toBe(true);
  });

  it('rejects native errors and process exits', async () => {
    service.startServices();
    const first = service.checkBiometricAuthChanged();
    const failed = first.then(
      () => 'resolved',
      () => 'rejected',
    );
    child.emit('message', {
      type,
      requestId: child.postMessage.mock.calls[0][0].requestId,
      error: true,
    });
    expect(await failed).toBe('rejected');
    const second = service.checkBiometricAuthChanged();
    const exited = second.then(
      () => 'resolved',
      () => 'rejected',
    );
    child.emit('exit', 1);
    expect(await exited).toBe('rejected');
    await expect(service.checkBiometricAuthChanged()).rejects.toThrow();
  });
});
