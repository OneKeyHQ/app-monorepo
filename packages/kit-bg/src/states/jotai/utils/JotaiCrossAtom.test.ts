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

function buildCrossAtom() {
  const baseAtom = atom<IValue>({ hideValue: false }) as unknown as Parameters<
    typeof wrapAtomPro
  >[1];
  baseAtom.initialValue = { hideValue: false };
  const proAtom = wrapAtomPro(EAtomNames.settingsValuePersistAtom, baseAtom);
  proAtom.storageReady = Promise.resolve(true);
  const crossAtom = new JotaiCrossAtom(
    EAtomNames.settingsValuePersistAtom,
    () => proAtom as IJotaiWritableAtomPro<IValue, [IValue], Promise<void>>,
  );
  return { crossAtom, proAtom };
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
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

  afterEach(() => {
    appGlobals.$jotaiBgSync = undefined;
  });

  it('plain set on a split runtime only proxies and waits for the bg echo', async () => {
    proxyStateUpdateActionFromUiToBg.mockReturnValue(new Promise(() => {}));
    const { crossAtom, proAtom } = buildCrossAtom();

    void crossAtom.set({ hideValue: true });
    await flushMicrotasks();

    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledWith({
      name: EAtomNames.settingsValuePersistAtom,
      payload: { hideValue: true },
    });
    expect(jotaiDefaultStore.get(proAtom)).toEqual({ hideValue: false });
  });

  it('applies the value on the UI runtime before the bg round trip settles', async () => {
    proxyStateUpdateActionFromUiToBg.mockReturnValue(new Promise(() => {}));
    const { crossAtom, proAtom } = buildCrossAtom();

    void crossAtom.setOptimistic({ hideValue: true });
    await flushMicrotasks();

    expect(jotaiDefaultStore.get(proAtom)).toEqual({ hideValue: true });
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledTimes(1);
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledWith({
      name: EAtomNames.settingsValuePersistAtom,
      payload: { hideValue: true },
    });
  });

  it('resolves once the bg write settles', async () => {
    proxyStateUpdateActionFromUiToBg.mockResolvedValue(undefined);
    const { crossAtom, proAtom } = buildCrossAtom();

    await crossAtom.setOptimistic({ hideValue: true });

    expect(jotaiDefaultStore.get(proAtom)).toEqual({ hideValue: true });
    expect(proxyStateUpdateActionFromUiToBg).toHaveBeenCalledTimes(1);
  });

  it('falls back to a direct set on a single-runtime target', async () => {
    mockPlatformEnv.isNativeMainThread = false;
    mockPlatformEnv.enableNativeBackgroundThread = false;
    const { crossAtom, proAtom } = buildCrossAtom();

    await crossAtom.setOptimistic({ hideValue: true });

    expect(jotaiDefaultStore.get(proAtom)).toEqual({ hideValue: true });
    expect(proxyStateUpdateActionFromUiToBg).not.toHaveBeenCalled();
  });
});
