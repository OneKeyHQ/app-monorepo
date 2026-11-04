import { EventEmitter } from 'events';

import {
  Availability,
  VerificationResult,
  allowSetForegroundWindow,
  checkAvailability,
  requestVerification,
} from '@onekeyfe/electron-windows-hello';
import { utilityProcess } from 'electron';
import Logger from 'electron-log/main';

import { BIOLOGY_AUTH_ABORTED_ERROR } from '@onekeyhq/shared/types/password';

import { EWindowHelloEventType } from '../service/enum';

jest.mock('electron', () => ({ utilityProcess: { fork: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));
jest.mock('@onekeyfe/electron-windows-hello', () => ({
  Availability: { Available: 'available' },
  VerificationResult: { Verified: 'verified', Canceled: 'canceled' },
  allowSetForegroundWindow: jest.fn(),
  checkAvailability: jest.fn(),
  requestVerification: jest.fn(),
}));

const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
const mainFunctionsDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  '$desktopMainAppFunctions',
);

describe('Windows Hello owner and foreground dispatch', () => {
  const handle = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  let focused: boolean;
  let service: typeof import('../service');
  let owner: EventEmitter & {
    isDestroyed: jest.Mock;
    isMinimized: jest.Mock;
    isFocused: () => boolean;
    restore: jest.Mock;
    show: jest.Mock;
    focus: jest.Mock;
    getNativeWindowHandle: () => Buffer;
  };
  let child: EventEmitter & {
    pid: number;
    postMessage: jest.Mock;
    kill: jest.Mock;
  };

  function reply(
    success: boolean,
    error?: string,
    requestId?: string,
    diagnostic?: string,
  ) {
    child.emit('message', {
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId:
        requestId ?? child.postMessage.mock.calls.at(-1)?.[0].requestId,
      result: { success, error },
      diagnostic,
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    focused = true;
    owner = Object.assign(new EventEmitter(), {
      isDestroyed: jest.fn(() => false),
      isMinimized: jest.fn(() => true),
      isFocused: () => focused,
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
      getNativeWindowHandle: () => handle,
    });
    child = Object.assign(new EventEmitter(), {
      pid: 1234,
      postMessage: jest.fn(),
      kill: jest.fn(() => true),
    });
    jest
      .mocked(utilityProcess)
      .fork.mockReturnValue(
        child as unknown as ReturnType<typeof utilityProcess.fork>,
      );
    jest.mocked(allowSetForegroundWindow).mockReturnValue(true);
    Object.defineProperty(globalThis, '$desktopMainAppFunctions', {
      configurable: true,
      value: { getSafelyMainWindow: () => owner },
    });
    jest.isolateModules(() => {
      service = jest.requireActual('../service');
    });
    service.startServices();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (platformDescriptor) {
      Object.defineProperty(process, 'platform', platformDescriptor);
    }
    if (mainFunctionsDescriptor) {
      Object.defineProperty(
        globalThis,
        '$desktopMainAppFunctions',
        mainFunctionsDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, '$desktopMainAppFunctions');
    }
  });

  it('waits for the real owner focus and grants only the utility process', async () => {
    focused = false;
    const pending = service.requestVerificationAsync('Unlock');
    expect(owner.restore).toHaveBeenCalledTimes(1);
    expect(owner.show).toHaveBeenCalledTimes(1);
    expect(owner.focus).toHaveBeenCalledTimes(1);
    expect(child.postMessage).not.toHaveBeenCalled();
    focused = true;
    owner.emit('focus');
    expect(allowSetForegroundWindow).toHaveBeenCalledWith(child.pid);
    expect(child.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: expect.any(String),
      params: { message: 'OneKey — Unlock', windowHandle: Array.from(handle) },
    });
    reply(false, 'user_cancel');
    await expect(pending).resolves.toEqual({
      success: false,
      error: 'user_cancel',
    });
    owner.emit('focus');
    expect(child.postMessage).toHaveBeenCalledTimes(1);
    expect(owner.listenerCount('focus')).toBe(0);
  });

  it('does not dispatch when foreground permission is denied', async () => {
    jest.mocked(allowSetForegroundWindow).mockReturnValue(false);
    await expect(service.requestVerificationAsync('Unlock')).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(child.postMessage).not.toHaveBeenCalled();
    expect(child.listenerCount('message')).toBe(1);
  });

  it('rejects overlapping verification instead of sharing authorization', async () => {
    const first = service.requestVerificationAsync('Unlock');
    await expect(service.requestVerificationAsync('Reveal')).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    reply(true);
    await expect(first).resolves.toMatchObject({ success: true });
    expect(child.postMessage).toHaveBeenCalledTimes(1);
  });

  it('settles a verification even if the user takes longer than one minute', async () => {
    const pending = service.requestVerificationAsync('Unlock');
    jest.advanceTimersByTime(65_000);
    reply(false, 'retries_exhausted');
    await expect(pending).resolves.toMatchObject({
      success: false,
      error: '',
    });
    expect(child.postMessage).toHaveBeenCalledTimes(1);
  });

  it('cleans up a request when its unfocused owner closes', async () => {
    focused = false;
    const pending = service.requestVerificationAsync('Unlock');
    owner.emit('closed');
    await expect(pending).resolves.toMatchObject({ success: false });
    focused = true;
    owner.emit('focus');
    expect(child.postMessage).not.toHaveBeenCalled();
    expect(owner.listenerCount('focus')).toBe(0);
    expect(child.listenerCount('message')).toBe(1);
  });

  it('never accepts a late reply belonging to a closed owner request', async () => {
    const first = service.requestVerificationAsync('Unlock');
    const oldId = child.postMessage.mock.calls[0][0].requestId as string;
    owner.emit('closed');
    await expect(first).resolves.toMatchObject({ success: false });
    const retiredChild = child;
    expect(retiredChild.kill).toHaveBeenCalledTimes(1);
    child = Object.assign(new EventEmitter(), {
      pid: 5678,
      postMessage: jest.fn(),
      kill: jest.fn(() => true),
    });
    jest
      .mocked(utilityProcess)
      .fork.mockReturnValue(
        child as unknown as ReturnType<typeof utilityProcess.fork>,
      );
    const available = service.checkAvailabilityAsync();
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: true,
    });
    await expect(available).resolves.toBe(true);
    const second = service.requestVerificationAsync('Reveal');
    retiredChild.emit('message', {
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: oldId,
      result: { success: true },
    });
    retiredChild.emit('exit', 1);
    reply(false, 'device_busy');
    await expect(second).resolves.toEqual({
      success: false,
      error: '',
    });
    await expect(service.checkAvailabilityAsync()).resolves.toBe(true);
  });

  it('settles on utility exit without restarting authentication', async () => {
    const pending = service.requestVerificationAsync('Unlock');
    child.emit('exit', 1);
    await expect(pending).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(jest.mocked(utilityProcess).fork).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a successful capability probe when its timer expires', async () => {
    const pending = service.checkAvailabilityAsync();
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: true,
    });
    await expect(pending).resolves.toBe(true);
    jest.advanceTimersByTime(5000);
    await expect(service.checkAvailabilityAsync()).resolves.toBe(true);
  });

  it('expires an unfocused request, removes listeners and permits an explicit new attempt', async () => {
    focused = false;
    const pending = service.requestVerificationAsync('Unlock');
    jest.advanceTimersByTime(5000);
    await expect(pending).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(owner.listenerCount('focus')).toBe(0);
    expect(owner.listenerCount('closed')).toBe(0);
    expect(child.listenerCount('message')).toBe(1);
    expect(child.listenerCount('exit')).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
    focused = true;
    owner.emit('focus');
    expect(child.postMessage).not.toHaveBeenCalled();
    const next = service.requestVerificationAsync('Unlock');
    reply(true);
    await expect(next).resolves.toEqual({ success: true });
    expect(child.postMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects a late focus even when the timeout callback has not run after suspension', async () => {
    focused = false;
    const pending = service.requestVerificationAsync('Unlock');
    jest.setSystemTime(Date.now() + 300_000);
    focused = true;
    owner.emit('focus');
    await expect(pending).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(child.postMessage).not.toHaveBeenCalled();
    expect(owner.listenerCount('focus')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('logs internal utility errors without forwarding them to the lock screen', async () => {
    const logInfo = jest.spyOn(Logger, 'info');
    const pending = service.requestVerificationAsync('Unlock');
    reply(false, 'HRESULT 0x80004005');
    await expect(pending).resolves.toEqual({ success: false, error: '' });
    expect(logInfo).toHaveBeenCalledWith(
      'Windows Hello verification failed',
      'HRESULT 0x80004005',
    );
  });

  it('records sanitized utility diagnostics in the main logger only', async () => {
    const logInfo = jest.spyOn(Logger, 'info');
    const available = service.checkAvailabilityAsync();
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: false,
      diagnostic: 'E_NOINTERFACE',
    });
    await expect(available).resolves.toBe(false);
    expect(logInfo).toHaveBeenCalledWith(
      'windowsHelloChildProcess-onMessage',
      expect.objectContaining({ diagnostic: 'E_NOINTERFACE' }),
    );
    const pending = service.requestVerificationAsync('Unlock');
    reply(false, '', undefined, 'retries_exhausted');
    await expect(pending).resolves.toEqual({ success: false, error: '' });
    expect(logInfo).toHaveBeenCalledWith(
      'windowsHelloChildProcess-onMessage',
      expect.objectContaining({ diagnostic: 'retries_exhausted' }),
    );
  });

  it('retires a stalled utility and recovers only on a new explicit attempt', async () => {
    const pending = service.requestVerificationAsync('Unlock');
    const retiredChild = child;
    jest.advanceTimersByTime(300_000);
    await expect(pending).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(retiredChild.kill).toHaveBeenCalledTimes(1);
    expect(retiredChild.listenerCount('message')).toBe(1);
    expect(retiredChild.listenerCount('exit')).toBe(1);
    expect(owner.listenerCount('focus')).toBe(0);
    expect(owner.listenerCount('closed')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    owner.emit('focus');
    expect(retiredChild.postMessage).toHaveBeenCalledTimes(1);
    expect(jest.mocked(utilityProcess).fork).toHaveBeenCalledTimes(1);
    child = Object.assign(new EventEmitter(), {
      pid: 5678,
      postMessage: jest.fn(),
      kill: jest.fn(() => true),
    });
    jest
      .mocked(utilityProcess)
      .fork.mockReturnValue(
        child as unknown as ReturnType<typeof utilityProcess.fork>,
      );
    const available = service.checkAvailabilityAsync();
    retiredChild.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: false,
    });
    retiredChild.emit('exit', 1);
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: true,
    });
    await expect(available).resolves.toBe(true);
    const next = service.requestVerificationAsync('Unlock');
    reply(true);
    await expect(next).resolves.toEqual({ success: true });
    expect(jest.mocked(utilityProcess).fork).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects an expired native success before delayed timers run after suspension', async () => {
    const pending = service.requestVerificationAsync('Unlock');
    jest.setSystemTime(Date.now() + 300_000);
    reply(true);
    await expect(pending).resolves.toEqual({
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    });
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('recovers a timed-out capability probe when its late result arrives', async () => {
    const pending = service.checkAvailabilityAsync();
    jest.advanceTimersByTime(5000);
    await expect(pending).resolves.toBe(false);
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: true,
    });
    await Promise.resolve();
    await expect(service.checkAvailabilityAsync()).resolves.toBe(true);
    expect(child.postMessage).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh capability probe after a timeout without a cached negative result', async () => {
    const first = service.checkAvailabilityAsync();
    jest.advanceTimersByTime(5000);
    await expect(first).resolves.toBe(false);
    const next = service.checkAvailabilityAsync();
    expect(child.postMessage).toHaveBeenCalledTimes(2);
    child.emit('message', {
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: true,
    });
    await expect(next).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Windows Hello utility results', () => {
  let port: EventEmitter & { postMessage: jest.Mock };
  const parentPortDescriptor = Object.getOwnPropertyDescriptor(
    process,
    'parentPort',
  );

  beforeEach(() => {
    jest.clearAllMocks();
    port = Object.assign(new EventEmitter(), { postMessage: jest.fn() });
    Object.defineProperty(process, 'parentPort', {
      configurable: true,
      value: port,
    });
    jest.isolateModules(() => {
      jest.requireActual('../service/windowsHello');
    });
  });

  afterEach(() => {
    if (parentPortDescriptor) {
      Object.defineProperty(process, 'parentPort', parentPortDescriptor);
    } else {
      Reflect.deleteProperty(process, 'parentPort');
    }
  });

  async function verify() {
    port.emit('message', {
      data: {
        type: EWindowHelloEventType.RequestVerificationAsync,
        requestId: 'request-1',
        params: { message: 'OneKey — Unlock', windowHandle: Array(8).fill(1) },
      },
    });
    await Promise.resolve();
  }

  it('reports an unavailable interface without showing verification', async () => {
    jest
      .mocked(checkAvailability)
      .mockRejectedValue(new Error('E_NOINTERFACE'));
    port.emit('message', {
      data: { type: EWindowHelloEventType.CheckAvailabilityAsync },
    });
    await Promise.resolve();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.CheckAvailabilityAsync,
      result: false,
      diagnostic: 'E_NOINTERFACE',
    });
    expect(requestVerification).not.toHaveBeenCalled();
  });

  it('accepts only the verified native result and reconstructs handle bytes', async () => {
    jest.mocked(checkAvailability).mockResolvedValue(Availability.Available);
    jest
      .mocked(requestVerification)
      .mockResolvedValue(VerificationResult.Verified);
    await verify();
    expect(requestVerification).toHaveBeenCalledWith({
      message: 'OneKey — Unlock',
      windowHandle: Buffer.alloc(8, 1),
    });
    expect(port.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: 'request-1',
      result: { success: true, error: undefined },
    });
  });

  it.each([
    'canceled',
    'device_busy',
    'retries_exhausted',
    'device_not_present',
    'not_configured_for_user',
    'disabled_by_policy',
  ] as const)('returns %s without retrying', async (result) => {
    jest.mocked(requestVerification).mockResolvedValue(result);
    await verify();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: 'request-1',
      result: {
        success: false,
        error: result === 'canceled' ? 'user_cancel' : '',
      },
      diagnostic: result === 'canceled' ? undefined : result,
    });
    expect(requestVerification).toHaveBeenCalledTimes(1);
  });

  it('settles native errors without retrying or authorizing', async () => {
    jest
      .mocked(requestVerification)
      .mockRejectedValue(new Error('HRESULT error'));
    await verify();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: 'request-1',
      result: { success: false, error: BIOLOGY_AUTH_ABORTED_ERROR },
      diagnostic: 'HRESULT error',
    });
    expect(requestVerification).toHaveBeenCalledTimes(1);
  });
});

describe('non-Windows service initialization', () => {
  let service: typeof import('../service');

  afterEach(() => {
    jest.dontMock('@onekeyfe/electron-windows-hello');
    jest.resetModules();
    if (platformDescriptor) {
      Object.defineProperty(process, 'platform', platformDescriptor);
    }
  });

  it.each(['darwin', 'linux'] as const)(
    'does not load the Hello module on %s',
    async (platform) => {
      jest.resetModules();
      Object.defineProperty(process, 'platform', { value: platform });
      const loadHello = jest.fn(() => ({}));
      jest.doMock('@onekeyfe/electron-windows-hello', loadHello);
      jest.isolateModules(() => {
        service = jest.requireActual('../service');
        jest
          .requireMock<{ utilityProcess: { fork: jest.Mock } }>('electron')
          .utilityProcess.fork.mockReturnValue(new EventEmitter());
        service.startServices();
      });
      await expect(service.requestVerificationAsync('Unlock')).resolves.toEqual(
        {
          success: false,
          error: '',
        },
      );
      expect(loadHello).not.toHaveBeenCalled();
    },
  );
});
