// cspell:ignore IMMKV
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { OneKeyLocalError } from '../errors';
import stringUtils from '../utils/stringUtils';

import { NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY } from './nativeStorageTypes';

import type { IMMKVInstance } from './nativeStorageExecutor';
import type { INativeAppStorageEmergencyStatus } from './nativeStorageTypes';

const JOURNAL_KEY = '__onekey_internal_app_storage_batch_journal_v1__';
const ARCHIVE_PREFIX =
  '__onekey_internal_app_storage_repair_journal_backup_v1__:emergency-';
const PROBE_KEY = '__onekey_internal_app_storage_emergency_probe_v1__';
const POLICY = 'retain-current-without-legacy-merge-v1';
type IControl = {
  version: 1;
  epoch: string;
  phase: 'preparing' | 'active' | 'clearing';
  archiveHash: string;
  policy: typeof POLICY;
};
type IArchive = { version: 1; journal?: string; pendingRecovery?: string };
type IGuard = () => void;
const checksum = (value: string) => bytesToHex(sha256(utf8ToBytes(value)));

/** Called only by the bg owner while its AppStorage operation queue is held. */
export function createNativeAppStorageEmergencyController(dependencies: {
  getMMKV: () => IMMKVInstance;
  sync: () => Promise<unknown>;
  assertFault: () => Promise<void>;
  getPendingJournal: () => string | undefined;
  clearPendingJournal: () => void;
  clearApplicationData: () => Promise<void>;
}) {
  // A failed durability barrier may already have changed the mmap. No later
  // operation may interpret that in-memory mutation as a durable commit.
  let pendingWrite: { value: string | undefined } | undefined;
  let cachedActive: { raw: string; control: IControl } | undefined;
  const fail = (message: string): never => {
    throw new OneKeyLocalError(message);
  };
  const parseObject = <T extends object>(
    raw: string,
    label: string,
  ): Partial<T> => {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return fail(`Emergency storage ${label} is invalid`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return fail(`Emergency storage ${label} is invalid`);
    return value as Partial<T>;
  };
  const readArchive = (control: IControl): IArchive => {
    const raw = dependencies
      .getMMKV()
      .getString(ARCHIVE_PREFIX + control.epoch);
    if (raw === undefined || checksum(raw) !== control.archiveHash)
      return fail(
        'Emergency storage transaction archive is unavailable or changed',
      );
    const archive = parseObject<IArchive>(raw, 'transaction archive');
    if (
      archive.version !== 1 ||
      (archive.journal !== undefined && typeof archive.journal !== 'string') ||
      (archive.pendingRecovery !== undefined &&
        typeof archive.pendingRecovery !== 'string')
    )
      return fail('Emergency storage transaction archive is invalid');
    return archive as IArchive;
  };
  const readControl = (): IControl | undefined => {
    const raw = dependencies
      .getMMKV()
      .getString(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY);
    if (raw === undefined) return undefined;
    if (cachedActive?.raw === raw) return cachedActive.control;
    const control = parseObject<IControl>(raw, 'control state');
    if (
      control.version !== 1 ||
      control.policy !== POLICY ||
      typeof control.epoch !== 'string' ||
      !/^\d{1,16}-[a-z0-9]{1,32}$/.test(control.epoch) ||
      !['preparing', 'active', 'clearing'].includes(control.phase ?? '') ||
      typeof control.archiveHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(control.archiveHash)
    )
      return fail('Emergency storage control state is invalid');
    if (control.phase !== 'clearing') readArchive(control as IControl);
    return control as IControl;
  };
  const flushPending = async (guard: IGuard) => {
    if (!pendingWrite) return;
    const mutation = pendingWrite;
    guard();
    const mmkv = dependencies.getMMKV();
    if (mutation.value === undefined)
      mmkv.remove(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY);
    else mmkv.set(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY, mutation.value);
    await dependencies.sync();
    guard();
    if (
      mmkv.getString(NATIVE_APP_STORAGE_EMERGENCY_CONTROL_KEY) !==
      mutation.value
    )
      fail('Emergency storage control persistence verification failed');
    pendingWrite = undefined;
  };
  const writeControl = async (control: IControl | undefined, guard: IGuard) => {
    cachedActive = undefined;
    pendingWrite = {
      value: control ? stringUtils.stableStringify(control) : undefined,
    };
    await flushPending(guard);
  };
  const status = (control: IControl): INativeAppStorageEmergencyStatus => ({
    mode: 'emergency',
    epoch: control.epoch,
    phase: control.phase,
    policy: POLICY,
  });
  const verifyWritable = async (guard: IGuard) => {
    const mmkv = dependencies.getMMKV();
    guard();
    mmkv.set(PROBE_KEY, '1');
    await dependencies.sync();
    guard();
    if (mmkv.getString(PROBE_KEY) !== '1')
      fail('Emergency storage is not writable');
    mmkv.remove(PROBE_KEY);
    await dependencies.sync();
    guard();
    if (mmkv.getAllKeys().includes(PROBE_KEY))
      fail('Emergency storage remove verification failed');
  };
  const resume = async (
    guard: IGuard,
  ): Promise<INativeAppStorageEmergencyStatus | undefined> => {
    guard();
    await flushPending(guard);
    let control = readControl();
    if (!control) return undefined;
    if (control.phase === 'clearing') {
      // Only an explicit app-storage clear creates this phase. Repeating it
      // after a crash is safe because writes remain fenced until its removal.
      await dependencies.clearApplicationData();
      guard();
      await writeControl(undefined, guard);
      return undefined;
    }
    await dependencies.assertFault();
    guard();
    if (control.phase === 'active') {
      cachedActive = { raw: stringUtils.stableStringify(control), control };
      return status(control);
    }
    const archive = readArchive(control);
    const mmkv = dependencies.getMMKV();
    const hasJournal = mmkv.getAllKeys().includes(JOURNAL_KEY);
    const live = mmkv.getString(JOURNAL_KEY);
    if (
      (hasJournal && live === undefined) ||
      (live !== undefined &&
        live !== archive.journal &&
        live !== archive.pendingRecovery)
    )
      fail('Live transaction journal changed before emergency activation');
    guard();
    mmkv.remove(JOURNAL_KEY);
    await dependencies.sync();
    guard();
    if (mmkv.getAllKeys().includes(JOURNAL_KEY))
      fail('Old transaction journal could not be fenced');
    dependencies.clearPendingJournal();
    await verifyWritable(guard);
    control = { ...control, phase: 'active' };
    await writeControl(control, guard);
    cachedActive = { raw: stringUtils.stableStringify(control), control };
    return status(control);
  };
  return {
    hasPendingWork: () => pendingWrite !== undefined,
    resume,
    async activate(guard: IGuard) {
      guard();
      await flushPending(guard);
      if (readControl()) {
        const resumed = await resume(guard);
        if (resumed) await verifyWritable(guard);
        return resumed;
      }
      await dependencies.assertFault();
      guard();
      const mmkv = dependencies.getMMKV();
      const hasJournal = mmkv.getAllKeys().includes(JOURNAL_KEY);
      const journal = mmkv.getString(JOURNAL_KEY);
      if (hasJournal && journal === undefined)
        return fail('Cannot archive the unreadable transaction journal');
      const epoch = `${Date.now()}-${Math.random().toString(36).slice(2) || '0'}`;
      const raw = stringUtils.stableStringify({
        version: 1,
        journal,
        pendingRecovery: dependencies.getPendingJournal(),
      });
      const key = ARCHIVE_PREFIX + epoch;
      if (mmkv.getAllKeys().includes(key))
        return fail('Emergency transaction archive already exists');
      mmkv.set(key, raw);
      await dependencies.sync();
      guard();
      if (mmkv.getString(key) !== raw)
        return fail(
          'Emergency transaction archive persistence verification failed',
        );
      await writeControl(
        {
          version: 1,
          epoch,
          phase: 'preparing',
          archiveHash: checksum(raw),
          policy: POLICY,
        },
        guard,
      );
      return resume(guard);
    },
    async clear(guard: IGuard) {
      await flushPending(guard);
      const control = readControl();
      if (!control) return fail('Emergency storage is not active');
      await writeControl({ ...control, phase: 'clearing' }, guard);
      return resume(guard);
    },
  };
}
