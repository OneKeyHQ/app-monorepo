import resetUtils from '../utils/resetUtils';

import { buildAppStorageFactory } from './appStorageBuildFactory';

import type { AsyncStorageStatic } from './appStorageTypes';

jest.mock('../appGlobals', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../utils/debug/dbPerfMonitor', () => ({
  __esModule: true,
  default: { logAppStorageCall: jest.fn() },
}));

jest.mock('./createPrintMethod', () => ({
  createPrintMethod: jest.fn(),
}));

jest.mock('./instance/secureStorageInstance', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./instance/syncStorageInstance', () => ({
  syncStorage: {},
}));

function buildStorage({
  clear = jest.fn().mockResolvedValue(undefined),
  multiRemove = jest.fn().mockResolvedValue(undefined),
  multiSet = jest.fn().mockResolvedValue(undefined),
  removeItem = jest.fn().mockResolvedValue(undefined),
  setItem = jest.fn().mockResolvedValue(undefined),
}: {
  clear?: jest.Mock;
  multiRemove?: jest.Mock;
  multiSet?: jest.Mock;
  removeItem?: jest.Mock;
  setItem?: jest.Mock;
} = {}) {
  const storage = {
    clear,
    flushGetRequests: jest.fn(),
    getAllKeys: jest.fn().mockResolvedValue([]),
    getItem: jest.fn().mockResolvedValue(null),
    mergeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiMerge: jest.fn().mockResolvedValue(undefined),
    multiRemove,
    multiSet,
    removeItem,
    setItem,
  } as unknown as AsyncStorageStatic;
  return { clear, multiRemove, multiSet, removeItem, setItem, storage };
}

describe('buildAppStorageFactory reset fence', () => {
  afterEach(async () => {
    await resetUtils.waitForResetSensitiveTasksToSettle();
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    jest.restoreAllMocks();
  });

  it('drains without rolling back a write when reset is still reversible', async () => {
    let finishWrite: (() => void) | undefined;
    const originalWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const { removeItem, storage } = buildStorage({
      setItem: jest.fn(() => originalWrite),
    });
    const appStorage = buildAppStorageFactory(storage);

    const write = appStorage.setItem('persist-key', 'new-value');
    resetUtils.startResetting();

    let drained = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    finishWrite?.();
    await expect(write).resolves.toBeUndefined();
    await drain;
    resetUtils.endResetting();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('keeps a same-generation write and reports callback success', async () => {
    const { removeItem, storage } = buildStorage();
    const appStorage = buildAppStorageFactory(storage);
    const callback = jest.fn();

    await appStorage.setItem('persist-key', 'value', callback);

    expect(removeItem).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('drains a pre-prepare multiSet without deleting its keys', async () => {
    let finishWrite: (() => void) | undefined;
    const originalWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const multiRemove = jest.fn().mockResolvedValue(undefined);
    const { removeItem, storage } = buildStorage({
      multiRemove,
      multiSet: jest.fn(() => originalWrite),
    });
    const appStorage = buildAppStorageFactory(storage);

    const write = appStorage.multiSet([
      ['first', 'value-1'],
      ['second', 'value-2'],
    ]);
    resetUtils.startResetting();
    const drain = resetUtils.waitForResetSensitiveTasksToSettle();

    finishWrite?.();
    await expect(write).resolves.toBeUndefined();
    await drain;
    expect(multiRemove).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('blocks data-creating mutators after reset starts', () => {
    const { storage } = buildStorage();
    const appStorage = buildAppStorageFactory(storage);
    resetUtils.startResetting();

    expect(() => appStorage.mergeItem('key', 'value')).toThrow(
      'Cannot perform operation while resetting',
    );
    expect(() => appStorage.multiSet([['key', 'value']])).toThrow(
      'Cannot perform operation while resetting',
    );
    expect(() => appStorage.multiMerge([['key', 'value']])).toThrow(
      'Cannot perform operation while resetting',
    );
  });

  it('drains a remove that entered before reset and calls its callback once', async () => {
    let finishRemove: (() => void) | undefined;
    const originalRemove = new Promise<void>((resolve) => {
      finishRemove = resolve;
    });
    const { storage } = buildStorage({
      removeItem: jest.fn(() => originalRemove),
    });
    const appStorage = buildAppStorageFactory(storage);
    const callback = jest.fn();

    const remove = appStorage.removeItem('one', callback);
    resetUtils.startResetting();
    let drainSettled = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    finishRemove?.();
    await expect(remove).resolves.toBeUndefined();
    await drain;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('drains a multiRemove that entered before reset and calls its callback once', async () => {
    let finishRemove: (() => void) | undefined;
    const originalRemove = new Promise<void>((resolve) => {
      finishRemove = resolve;
    });
    const { storage } = buildStorage({
      multiRemove: jest.fn(() => originalRemove),
    });
    const appStorage = buildAppStorageFactory(storage);
    const callback = jest.fn();

    const remove = appStorage.multiRemove(['one', 'two'], callback);
    resetUtils.startResetting();
    const drain = resetUtils.waitForResetSensitiveTasksToSettle();

    finishRemove?.();
    await expect(remove).resolves.toBeUndefined();
    await drain;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('rejects remove and multiRemove during reset with one callback each', () => {
    const { multiRemove, removeItem, storage } = buildStorage();
    const appStorage = buildAppStorageFactory(storage);
    const removeCallback = jest.fn();
    const multiRemoveCallback = jest.fn();
    resetUtils.startResetting();

    expect(() => appStorage.removeItem('one', removeCallback)).toThrow(
      'Cannot perform operation while resetting',
    );
    expect(() => appStorage.multiRemove(['two'], multiRemoveCallback)).toThrow(
      'Cannot perform operation while resetting',
    );

    expect(removeItem).not.toHaveBeenCalled();
    expect(multiRemove).not.toHaveBeenCalled();
    expect(removeCallback).toHaveBeenCalledTimes(1);
    expect(removeCallback).toHaveBeenCalledWith(expect.any(Error));
    expect(multiRemoveCallback).toHaveBeenCalledTimes(1);
    expect(multiRemoveCallback).toHaveBeenCalledWith([expect.any(Error)]);
  });

  it('keeps clear available to Reset App itself', async () => {
    const { clear, storage } = buildStorage();
    const appStorage = buildAppStorageFactory(storage);
    resetUtils.startResetting();

    await appStorage.clear();

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
