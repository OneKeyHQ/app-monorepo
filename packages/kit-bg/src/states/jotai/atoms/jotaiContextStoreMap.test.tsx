/** @jest-environment jsdom */

import { createElement, useEffect } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJotaiContextStoreMap } from './jotaiContextStoreMap';

function createMapSetter() {
  return jest.fn((_update: unknown): void | Promise<void> => Promise.resolve());
}

type IMapSetter = ReturnType<typeof createMapSetter>;

type ITestGlobal = typeof globalThis & {
  __onekeyJotaiContextStoreMapTestSetter?: IMapSetter;
};

jest.mock('../utils', () => ({
  globalAtom: () => ({
    target: {},
    use: () => [
      {},
      (update: unknown) =>
        (globalThis as ITestGlobal).__onekeyJotaiContextStoreMapTestSetter?.(
          update,
        ),
    ],
  }),
}));

const {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
  useJotaiContextTrackerMap,
} = jest.requireActual<typeof import('./jotaiContextStoreMap')>(
  './jotaiContextStoreMap',
);

function TrackerHarness({ map }: { map: IJotaiContextStoreMap }) {
  const { setMap } = useJotaiContextTrackerMap();
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  return null;
}

function clearMemoMap() {
  const map = getJotaiContextTrackerMap();
  Object.keys(map).forEach((key) => delete map[key]);
}

describe('jotaiContextStoreMap native mirror registration', () => {
  let setMap: IMapSetter;

  beforeEach(() => {
    setMap = createMapSetter();
    (globalThis as ITestGlobal).__onekeyJotaiContextStoreMapTestSetter = setMap;
    platformEnv.isNativeMainThread = false;
    platformEnv.enableNativeBackgroundThread = false;
    platformEnv.isExtensionUi = false;
    clearMemoMap();
  });

  afterEach(() => {
    delete (globalThis as ITestGlobal).__onekeyJotaiContextStoreMapTestSetter;
    clearMemoMap();
    jest.clearAllMocks();
  });

  it('writes the native main registration locally before syncing it to bg', async () => {
    platformEnv.isNativeMainThread = true;
    platformEnv.enableNativeBackgroundThread = true;
    setMap
      .mockImplementationOnce(() => Promise.reject(new Error('local write')))
      .mockImplementationOnce(() => Promise.reject(new Error('bg starting')));
    const map: IJotaiContextStoreMap = {
      'store:accountSelector@home': {
        storeName: EJotaiContextStoreNames.accountSelector,
        count: 1,
      },
    };

    render(createElement(TrackerHarness, { map }));

    await waitFor(() => expect(setMap).toHaveBeenCalledTimes(2));
    expect(setMap.mock.calls[0]?.[0]).toEqual({
      $$isForceSetAtomWithoutProxy: true,
      name: 'jotaiContextStoreMapAtom',
      payload: map,
    });
    expect(setMap.mock.calls[1]?.[0]).toBe(map);
    expect(getJotaiContextTrackerMap()).toBe(map);
  });

  it.each([
    ['desktop', false, false, false],
    ['web', false, false, false],
    ['extension UI', false, false, true],
    ['native standalone', true, false, false],
  ])(
    'keeps the existing single-write path on %s',
    async (
      _runtime,
      isNativeMainThread,
      enableNativeBackgroundThread,
      isExtensionUi,
    ) => {
      platformEnv.isNativeMainThread = isNativeMainThread;
      platformEnv.enableNativeBackgroundThread = enableNativeBackgroundThread;
      platformEnv.isExtensionUi = isExtensionUi;
      const map: IJotaiContextStoreMap = {
        'store:swap': {
          storeName: EJotaiContextStoreNames.swap,
          count: 1,
        },
      };

      render(createElement(TrackerHarness, { map }));

      await waitFor(() => expect(setMap).toHaveBeenCalledTimes(1));
      expect(setMap).toHaveBeenCalledWith(map);
    },
  );
});
