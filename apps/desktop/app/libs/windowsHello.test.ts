import { EventEmitter } from 'events';

import { utilityProcess } from 'electron';
import {
  Availability,
  VerificationResult,
  allowSetForegroundWindow,
  checkAvailability,
  requestVerification,
} from 'electron-windows-hello';

import { EWindowHelloEventType } from '../service/enum';

jest.mock('electron', () => ({ utilityProcess: { fork: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));
jest.mock('electron-windows-hello', () => ({
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
  let child: EventEmitter & { pid: number; postMessage: jest.Mock };

  function reply(success: boolean, error?: string, requestId?: string) {
    child.emit('message', {
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId:
        requestId ?? child.postMessage.mock.calls.at(-1)?.[0].requestId,
      result: { success, error },
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
    });
    jest
      .mocked(utilityProcess.fork)
      .mockReturnValue(
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
      error: 'Windows Hello foreground denied',
    });
    expect(child.postMessage).not.toHaveBeenCalled();
    expect(child.listenerCount('message')).toBe(1);
  });

  it('rejects overlapping verification instead of sharing authorization', async () => {
    const first = service.requestVerificationAsync('Unlock');
    await expect(service.requestVerificationAsync('Reveal')).resolves.toEqual({
      success: false,
      error: 'device_busy',
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
      error: 'retries_exhausted',
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
    const second = service.requestVerificationAsync('Reveal');
    reply(true, undefined, oldId);
    reply(false, 'device_busy');
    await expect(second).resolves.toEqual({
      success: false,
      error: 'device_busy',
    });
  });

  it('settles on utility exit without restarting authentication', async () => {
    const pending = service.requestVerificationAsync('Unlock');
    child.emit('exit', 1);
    await expect(pending).resolves.toMatchObject({ success: false });
    await expect(service.checkAvailabilityAsync()).resolves.toBe(false);
    expect(utilityProcess.fork).toHaveBeenCalledTimes(1);
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

  it.each(['canceled', 'device_busy', 'retries_exhausted'] as const)(
    'returns %s without retrying',
    async (result) => {
      jest.mocked(requestVerification).mockResolvedValue(result);
      await verify();
      expect(port.postMessage).toHaveBeenCalledWith({
        type: EWindowHelloEventType.RequestVerificationAsync,
        requestId: 'request-1',
        result: {
          success: false,
          error: result === 'canceled' ? 'user_cancel' : result,
        },
      });
      expect(requestVerification).toHaveBeenCalledTimes(1);
    },
  );

  it('settles native errors without retrying or authorizing', async () => {
    jest
      .mocked(requestVerification)
      .mockRejectedValue(new Error('HRESULT error'));
    await verify();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: EWindowHelloEventType.RequestVerificationAsync,
      requestId: 'request-1',
      result: { success: false, error: 'HRESULT error' },
    });
    expect(requestVerification).toHaveBeenCalledTimes(1);
  });
});
