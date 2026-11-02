/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUi: false,
    isExtensionBackground: false,
    isNativeMainThread: true,
    isNativeBackgroundThread: false,
    enableNativeBackgroundThread: true,
  },
}));

import { atom } from 'jotai';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EAtomNames } from '../atomNames';

// The mocked module object is shared, so tests mutate it to pick a runtime.
const mockPlatformEnv = platformEnv as unknown as {
  isExtensionUi: boolean;
  isNativeMainThread: boolean;
  enableNativeBackgroundThread: boolean;
};

import { JotaiCrossAtom } from './JotaiCrossAtom';
import { jotaiDefaultStore } from './jotaiDefaultStore';
import { wrapAtomPro } from './wrapAtomPro';

import type { IJotaiWritableAtomPro } from '../types';

type IValue = { hideValue: boolean };

const HIDDEN: IValue = { hideValue: true };
const SHOWN: IValue = { hideValue: false };

function buildCrossAtom() {
  const baseAtom = atom<IValue>(SHOWN) as unknown as Parameters<
    typeof wrapAtomPro
  >[1];
  baseAtom.initialValue = SHOWN;
  const proAtom = wrapAtomPro(EAtomNames.settingsValuePersistAtom, baseAtom);
  proAtom.storageReady = Promise.resolve(true);
  const crossAtom = new JotaiCrossAtom(
    EAtomNames.settingsValuePersistAtom,
    () => proAtom as IJotaiWritableAtomPro<IValue, [IValue], Promise<void>>,
  );
  return { crossAtom, proAtom };
}

// What the bg runtime sends back after it commits a write.
function echoFromBg(
  proAtom: ReturnType<typeof buildCrossAtom>['proAtom'],
  payload: IValue,
) {
  return jotaiDefaultStore.set(proAtom, {
    $$isFromBgStatesSyncBroadcast: true,
    name: EAtomNames.settingsValuePersistAtom,
    payload,
  });
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

type IBgWrite = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

// Every forward to bg is settled by the end of a test (or in `afterEach`) so
// the per-atom optimistic bookkeeping never leaks into the next test.
const openBgWrites: IBgWrite[] = [];

function createBgWrite(): IBgWrite {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // A write settled by `afterEach` cleanup must not surface as unhandled.
  promise.catch(() => {});
  const write = { promise, resolve, reject };
  openBgWrites.push(write);
  return write;
}

describe('JotaiCrossAtom.setOptimistic', () => {
  const proxyStateUpdateActionFromUiToBg = jest.fn();

  beforeEach(() => {
    proxyStateUpdateActionFromUiToBg.mockReset();
    mockPlatformEnv.isNativeMainThread = true;
    mockPlatformEnv.enableNativeBackgroundThread = true;
    mockPlatformEnv.isExtensionUi = false;
    appGlobals.$jotaiBgSync = {
      proxyStateUpdateActionFromUiToBg,
    } as unknown as typeof appGlobals.$jotaiBgSync;
  });

  afterEach(async () => {
    for (const write of openBgWrites.splice(0)) {
      write.resolve();
    }
    await flushMicrotasks();
    appGlobals.$jotaiBgSync = undefined;
  });

  it('plain set on a split runtime only proxies and waits for the bg echo', async () => {
    proxyStateUpdateActionFromUiToBg.mockReturnValue(createBgWrite().promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    void crossAtom.set(HIDDEN);
    await flushMicrotasks();

    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledWith({
      name: EAtomNames.settingsValuePersistAtom,
      payload: HIDDEN,
    });
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);
  });

  it('applies the value on the UI runtime before the bg round trip settles', async () => {
    proxyStateUpdateActionFromUiToBg.mockReturnValue(createBgWrite().promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    void crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();

    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledTimes(1);
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledWith({
      name: EAtomNames.settingsValuePersistAtom,
      payload: HIDDEN,
    });
  });

  it('resolves once the bg write settles', async () => {
    proxyStateUpdateActionFromUiToBg.mockResolvedValue(undefined);
    const { crossAtom, proAtom } = buildCrossAtom();

    await crossAtom.setOptimistic(HIDDEN);

    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledTimes(1);
  });

  it('falls back to a direct set on a single-runtime target', async () => {
    mockPlatformEnv.isNativeMainThread = false;
    mockPlatformEnv.enableNativeBackgroundThread = false;
    const { crossAtom, proAtom } = buildCrossAtom();

    await crossAtom.setOptimistic(HIDDEN);

    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
    expect(proxyStateUpdateActionFromUiToBg).not.toHaveBeenCalled();
  });

  it('ignores the bg echo of an older write while a newer write is in flight', async () => {
    const first = createBgWrite();
    const second = createBgWrite();
    proxyStateUpdateActionFromUiToBg
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    // Hide, then show again before bg has committed the hide.
    void crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();
    void crossAtom.setOptimistic(SHOWN);
    await flushMicrotasks();
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);

    // Bg commits the hide first and echoes it: the UI must not flip back.
    await echoFromBg(proAtom, HIDDEN);
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);

    // The echo of the newest write still applies.
    await echoFromBg(proAtom, SHOWN);
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);

    first.resolve();
    second.resolve();
    await flushMicrotasks();
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);

    // With nothing in flight, bg-originated changes reach the UI again.
    await echoFromBg(proAtom, HIDDEN);
    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
  });

  it('restores the last accepted value and rethrows when bg rejects the write', async () => {
    const write = createBgWrite();
    proxyStateUpdateActionFromUiToBg.mockReturnValue(write.promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    const pending = crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();
    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);

    write.reject(new Error('travel mode blocked the write'));
    await expect(pending).rejects.toThrow('travel mode blocked the write');
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);
  });

  it('rolls back to the newest accepted write, not the pre-toggle value', async () => {
    const first = createBgWrite();
    const second = createBgWrite();
    proxyStateUpdateActionFromUiToBg
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    const hide = crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();
    const show = crossAtom.setOptimistic(SHOWN);
    await flushMicrotasks();

    first.resolve();
    await hide;
    second.reject(new Error('rejected'));
    await expect(show).rejects.toThrow('rejected');

    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
  });

  it('keeps the newer write when only an older one is rejected', async () => {
    const first = createBgWrite();
    const second = createBgWrite();
    proxyStateUpdateActionFromUiToBg
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    const hide = crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();
    const show = crossAtom.setOptimistic(SHOWN);
    await flushMicrotasks();

    first.reject(new Error('rejected'));
    await expect(hide).rejects.toThrow('rejected');
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);

    // Once the newer write is rejected too, nothing bg accepted remains.
    second.reject(new Error('rejected'));
    await expect(show).rejects.toThrow('rejected');
    expect(jotaiDefaultStore.get(proAtom)).toEqual(SHOWN);
  });

  it('reapplies an older in-flight write when the newer one is rejected first', async () => {
    const first = createBgWrite();
    const second = createBgWrite();
    proxyStateUpdateActionFromUiToBg
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { crossAtom, proAtom } = buildCrossAtom();

    const hide = crossAtom.setOptimistic(HIDDEN);
    await flushMicrotasks();
    const show = crossAtom.setOptimistic(SHOWN);
    await flushMicrotasks();

    // The newer write fails while the older one is still pending: the UI
    // should show the older write, which bg is still expected to accept.
    second.reject(new Error('rejected'));
    await expect(show).rejects.toThrow('rejected');
    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);

    first.resolve();
    await hide;
    expect(jotaiDefaultStore.get(proAtom)).toEqual(HIDDEN);
  });
});
