/* eslint-disable import/first */

const mockSyncJotaiContextTrackerMap = jest.fn<void, [unknown]>();
const mockSet = jest.fn<Promise<void>, [unknown, unknown]>(
  async () => undefined,
);

jest.mock('./atoms/jotaiContextStoreMap', () => ({
  syncJotaiContextTrackerMap: (payload: unknown) =>
    mockSyncJotaiContextTrackerMap(payload),
}));

jest.mock('./jotaiStorage', () => ({
  globalJotaiStorageReadyHandler: { resolveReady: jest.fn() },
}));

jest.mock('./utils', () => ({
  globalAtomRegistry: {
    get: () => ({ atom: () => ({}) }),
  },
}));

jest.mock('./utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    set: (atom: unknown, params: unknown) => mockSet(atom, params),
  },
}));

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EAtomNames } from './atomNames';
import {
  jotaiInitFromUi,
  jotaiUpdateFromUiByBgBroadcast,
} from './jotaiInitFromUi';

describe('jotai context store map hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isExtensionUi = false;
  });

  it('does not overwrite the native UI memo map from a bg echo', async () => {
    const staleMap = { 'store:stale': { count: 1 } };

    await jotaiUpdateFromUiByBgBroadcast({
      $$isFromBgStatesSyncBroadcast: true,
      name: EAtomNames.jotaiContextStoreMapAtom,
      payload: staleMap,
    });

    expect(mockSyncJotaiContextTrackerMap).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it('accepts the background-owned map in an extension UI', async () => {
    platformEnv.isExtensionUi = true;
    const registryMap = { 'store:extension': { count: 1 } };

    await jotaiUpdateFromUiByBgBroadcast({
      $$isFromBgStatesSyncBroadcast: true,
      name: EAtomNames.jotaiContextStoreMapAtom,
      payload: registryMap,
    });

    expect(mockSyncJotaiContextTrackerMap).toHaveBeenCalledWith(registryMap);
  });

  it('still hydrates the initial native memo map snapshot', async () => {
    const initialMap = { 'store:initial': { count: 1 } };

    await jotaiInitFromUi({
      states: { [EAtomNames.jotaiContextStoreMapAtom]: initialMap },
      useSnapshotInjection: true,
    });

    expect(mockSyncJotaiContextTrackerMap).toHaveBeenCalledWith(initialMap);
  });
});
