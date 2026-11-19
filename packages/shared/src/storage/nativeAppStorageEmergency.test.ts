// cspell:ignore IMMKV
import { OneKeyLocalError } from '../errors';

import { createNativeAppStorageEmergencyController } from './nativeAppStorageEmergency';
import { NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY } from './nativeStorageTypes';

import type { IMMKVInstance } from './nativeStorageExecutor';

const JOURNAL = '__onekey_internal_app_storage_batch_journal_v1__';
const MARKER = '__onekey_internal_app_storage_migration_v1__';
const ARCHIVE =
  '__onekey_internal_app_storage_repair_journal_backup_v1__:emergency-';
const oldJournal = JSON.stringify({
  version: 1,
  previousValues: [['app:item', 'old-value']],
});

function fixture() {
  let values = new Map<string, string>([
    ['app:item', 'current-value'],
    [JOURNAL, oldJournal],
  ]);
  let durable = new Map(values);
  let failAt = 0;
  let syncIndex = 0;
  let failAfterCommit = false;
  let pending: string | undefined = oldJournal;
  let runtimeAllowed = true;
  const legacy = new Map([['item', 'retained-legacy']]);
  const guard = () => {
    if (!runtimeAllowed) throw new OneKeyLocalError('Runtime changed');
  };
  const mmkv: IMMKVInstance = {
    getString: (key) => values.get(key),
    getNumber: () => undefined,
    getBoolean: () => undefined,
    set: (key, value) => {
      values.set(key, String(value));
    },
    remove: (key) => {
      values.delete(key);
    },
    getAllKeys: () => [...values.keys()],
    clearAll: () => values.clear(),
    trim: () => {},
  };
  const sync = async () => {
    syncIndex += 1;
    if (syncIndex === failAt && !failAfterCommit)
      throw new OneKeyLocalError('Injected durability failure');
    durable = new Map(values);
    if (syncIndex === failAt)
      throw new OneKeyLocalError('Injected uncertain durability failure');
  };
  const create = () =>
    createNativeAppStorageEmergencyController({
      getMMKV: () => mmkv,
      sync,
      assertFault: async () => {
        if (values.get(MARKER) === '1')
          throw new OneKeyLocalError('Not a migration mismatch');
      },
      getPendingJournal: () => pending,
      clearPendingJournal: () => {
        pending = undefined;
      },
      clearApplicationData: async () => {
        values.delete('app:item');
        legacy.clear();
        values.set(MARKER, '1');
        await sync();
      },
    });
  return {
    mmkv,
    persist: sync,
    legacy,
    guard,
    create,
    failSync: (index: number, afterCommit = false) => {
      syncIndex = 0;
      failAt = index;
      failAfterCommit = afterCommit;
    },
    allowSync: () => {
      failAt = 0;
    },
    changeRuntime: () => {
      runtimeAllowed = false;
    },
    crash: () => {
      values = new Map(durable);
      pending = undefined;
    },
  };
}

it('archives both rollback sources, fences the old journal and preserves every current and legacy record', async () => {
  const f = fixture();
  const controller = f.create();
  const result = await controller.activate(f.guard);
  expect(result).toMatchObject({
    mode: 'emergency',
    phase: 'active',
    policy: 'retain-current-without-legacy-merge-v1',
  });
  expect(f.mmkv.getString(MARKER)).toBeUndefined();
  expect(f.mmkv.getString('app:item')).toBe('current-value');
  expect(f.legacy.get('item')).toBe('retained-legacy');
  expect(f.mmkv.getAllKeys()).not.toContain(JOURNAL);
  const archive = f.mmkv.getAllKeys().find((key) => key.startsWith(ARCHIVE))!;
  expect(JSON.parse(f.mmkv.getString(archive)!)).toMatchObject({
    journal: oldJournal,
    pendingRecovery: oldJournal,
  });
  f.crash();
  await expect(f.create().resume(f.guard)).resolves.toMatchObject({
    epoch: result!.epoch,
    phase: 'active',
  });
  expect(f.mmkv.getString('app:item')).toBe('current-value');
});

it.each([1, 2, 3, 4, 5, 6])(
  'does not acknowledge activation at failed durability barrier %s and resumes safely after a crash',
  async (index) => {
    for (const afterCommit of [false, true]) {
      const f = fixture();
      f.failSync(index, afterCommit);
      await expect(f.create().activate(f.guard)).rejects.toThrow('durability');
      f.crash();
      f.allowSync();
      const cold = f.create();
      const status = await cold.resume(f.guard);
      if (!status) await cold.activate(f.guard);
      expect(f.mmkv.getString('app:item')).toBe('current-value');
      expect(f.mmkv.getString(MARKER)).toBeUndefined();
      expect(f.legacy.get('item')).toBe('retained-legacy');
      expect(f.mmkv.getAllKeys()).not.toContain(JOURNAL);
    }
  },
);

it('does not treat a failed in-memory active write as a durable success on warm retry', async () => {
  const f = fixture();
  const controller = f.create();
  f.failSync(6);
  await expect(controller.activate(f.guard)).rejects.toThrow('durability');
  expect(controller.hasPendingWork()).toBe(true);
  f.failSync(1);
  await expect(controller.resume(f.guard)).rejects.toThrow('durability');
  f.allowSync();
  await expect(controller.resume(f.guard)).resolves.toMatchObject({
    phase: 'active',
  });
});

it('rejects archive tampering, a changed live journal and a runtime change', async () => {
  const f = fixture();
  f.failSync(2);
  await expect(f.create().activate(f.guard)).rejects.toThrow();
  f.allowSync();
  f.mmkv.set(JOURNAL, 'another-live-journal');
  await expect(f.create().resume(f.guard)).rejects.toThrow('changed');
  const archive = f.mmkv.getAllKeys().find((key) => key.startsWith(ARCHIVE))!;
  f.mmkv.set(archive, 'tampered');
  await expect(f.create().resume(f.guard)).rejects.toThrow('archive');
  f.changeRuntime();
  await expect(f.create().activate(f.guard)).rejects.toThrow('Runtime changed');
});

it('rejects healthy storage and does not erase records when the target cannot persist writes', async () => {
  const f = fixture();
  f.mmkv.set(MARKER, '1');
  await expect(f.create().activate(f.guard)).rejects.toThrow(
    'Not a migration mismatch',
  );
  f.mmkv.remove(MARKER);
  f.failSync(1);
  await expect(f.create().activate(f.guard)).rejects.toThrow('durability');
  expect(f.mmkv.getString(JOURNAL)).toBe(oldJournal);
  expect(f.mmkv.getString('app:item')).toBe('current-value');
});

it.each([1, 2, 3])(
  'keeps an explicit erase fenced across failed durability barrier %s',
  async (index) => {
    for (const afterCommit of [false, true]) {
      const f = fixture();
      const controller = f.create();
      await controller.activate(f.guard);
      f.failSync(index, afterCommit);
      await expect(controller.clear(f.guard)).rejects.toThrow('durability');
      f.crash();
      f.allowSync();
      const cold = f.create();
      const status = await cold.resume(f.guard);
      // A crash before clearing intent commits retains the active snapshot.
      if (status) await cold.clear(f.guard);
      expect(
        f.mmkv.getString(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY),
      ).toBeUndefined();
      expect(f.mmkv.getString('app:item')).toBeUndefined();
      expect(f.legacy.size).toBe(0);
    }
  },
);

it('flushes uncertain control removal before later writes so a restart cannot repeat an old erase', async () => {
  const f = fixture();
  const controller = f.create();
  await controller.activate(f.guard);
  f.failSync(3);
  await expect(controller.clear(f.guard)).rejects.toThrow('durability');
  expect(controller.hasPendingWork()).toBe(true);
  f.allowSync();
  await expect(controller.resume(f.guard)).resolves.toBeUndefined();
  expect(controller.hasPendingWork()).toBe(false);
  f.mmkv.set('app:item', 'new-after-explicit-erase');
  await f.persist();
  f.crash();
  await expect(f.create().resume(f.guard)).resolves.toBeUndefined();
  expect(f.mmkv.getString('app:item')).toBe('new-after-explicit-erase');
});

it.each(['null', '[]', '{', '{"version":2}'])(
  'rejects corrupt control state %s without touching user records',
  async (raw) => {
    const f = fixture();
    f.mmkv.set(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY, raw);
    await expect(f.create().resume(f.guard)).rejects.toThrow(
      'control state is invalid',
    );
    expect(f.mmkv.getString(JOURNAL)).toBe(oldJournal);
    expect(f.mmkv.getString('app:item')).toBe('current-value');
    expect(f.legacy.get('item')).toBe('retained-legacy');
  },
);
