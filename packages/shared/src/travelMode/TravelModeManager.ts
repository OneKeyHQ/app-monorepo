import { OneKeyLocalError } from '../errors';

import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';

import type {
  IRuntimeEnvironment,
  ITravelModeControlRecord,
  ITravelModeControlStorage,
  ITravelModeProtectedOperationPermit,
  ITravelModeRuntimeProfile,
  ITravelModeRuntimeState,
} from './types';

const TRAVEL_MODE_TRANSITION_DRAIN_TIMEOUT_MS = 5000;
const VERIFY_STRING_PREFIX = '|VS|';

function isValidVerifyString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(VERIFY_STRING_PREFIX) &&
    value.length > VERIFY_STRING_PREFIX.length
  );
}

function parseControlRecord(
  value: string | null | undefined,
): ITravelModeControlRecord | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<ITravelModeControlRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.enabled !== 'boolean' ||
      !isValidVerifyString(parsed.verifyString)
    ) {
      return undefined;
    }
    return {
      enabled: parsed.enabled,
      verifyString: parsed.verifyString,
      version: 1,
    };
  } catch {
    return undefined;
  }
}

export class TravelModeManager {
  private activeOperationPermits = new WeakSet<object>();

  private controlRecord: ITravelModeControlRecord | null = null;

  private drainWaiters = new Set<() => void>();

  private initializationError: unknown;

  private inFlightProtectedOperations = 0;

  private runtimeState: ITravelModeRuntimeState = 'initializing';

  private runtimeProfile: ITravelModeRuntimeProfile;

  private runtimeEnvironment: IRuntimeEnvironment;

  private transitionPromise: Promise<void> = Promise.resolve();

  readonly ready: Promise<void>;

  constructor(
    private readonly storage: ITravelModeControlStorage,
    private readonly supported: boolean,
  ) {
    this.runtimeProfile = getTravelModeRuntimeProfile(supported);
    this.runtimeEnvironment = this.buildRuntimeEnvironment();
    if (!supported) {
      this.runtimeState = 'inactive';
      this.runtimeProfile = getTravelModeRuntimeProfile(false);
      this.runtimeEnvironment = this.buildRuntimeEnvironment();
      this.ready = Promise.resolve();
      return;
    }
    if (storage.getItemSync) {
      try {
        this.applyInitialValue(storage.getItemSync());
      } catch (error) {
        this.initializationError = error;
        this.runtimeState = 'active';
      }
      this.ready = this.publishInitialRuntimeMaskingState();
      return;
    }
    this.ready = Promise.resolve().then(() => this.initialize());
  }

  private async initialize() {
    try {
      this.applyInitialValue(await this.storage.getItem());
    } catch (error) {
      this.initializationError = error;
      this.runtimeState = 'active';
    } finally {
      this.publishRuntimeMaskingState();
    }
  }

  private applyInitialValue(value: string | null | undefined) {
    const parsed = parseControlRecord(value);
    if (parsed === undefined) {
      this.runtimeState = 'active';
      this.runtimeProfile = getTravelModeRuntimeProfile(true);
      this.runtimeEnvironment = this.buildRuntimeEnvironment();
      return;
    }
    this.controlRecord = parsed;
    this.runtimeState = parsed?.enabled ? 'active' : 'inactive';
    this.runtimeProfile = getTravelModeRuntimeProfile(Boolean(parsed?.enabled));
    this.runtimeEnvironment = this.buildRuntimeEnvironment();
  }

  isMaskingDataSync(): boolean {
    if (!this.supported || this.runtimeState !== 'inactive') {
      return this.supported;
    }
    try {
      return this.storage.getRuntimeMaskingSync?.() ?? false;
    } catch {
      return true;
    }
  }

  async isActive(): Promise<boolean> {
    await this.ready;
    return this.runtimeState !== 'inactive';
  }

  async getRuntimeState(): Promise<ITravelModeRuntimeState> {
    await this.ready;
    return this.runtimeState;
  }

  async getRuntimeProfile(): Promise<ITravelModeRuntimeProfile> {
    await this.ready;
    return this.runtimeProfile;
  }

  getRuntimeEnvironmentSync(): IRuntimeEnvironment {
    return this.runtimeEnvironment;
  }

  async getRuntimeEnvironment(): Promise<IRuntimeEnvironment> {
    await this.ready;
    return this.runtimeEnvironment;
  }

  async getPersistedEnabled(): Promise<boolean> {
    await this.ready;
    return this.controlRecord?.enabled ?? this.isMaskingDataSync();
  }

  async getBootstrapControlValue(): Promise<string | undefined> {
    await this.ready;
    if (!this.supported || this.runtimeState === 'inactive') {
      return undefined;
    }
    return JSON.stringify(
      this.controlRecord ?? {
        enabled: true,
        verifyString: '',
        version: 1,
      },
    );
  }

  async getVerifyString(): Promise<string> {
    await this.ready;
    const verifyString = this.controlRecord?.verifyString;
    if (!verifyString) {
      throw new OneKeyLocalError(
        'Travel Mode passcode verifier is unavailable',
      );
    }
    return verifyString;
  }

  async beginProtectedOperation(): Promise<(() => void) | undefined> {
    const permit = await this.acquireProtectedOperation();
    return permit ? () => permit.release() : undefined;
  }

  async acquireProtectedOperation(): Promise<
    ITravelModeProtectedOperationPermit | undefined
  > {
    if (!this.supported) {
      return this.createProtectedOperationPermit(false);
    }
    await this.ready;
    if (this.runtimeState !== 'inactive' || this.isMaskingDataSync()) {
      return undefined;
    }
    this.inFlightProtectedOperations += 1;
    return this.createProtectedOperationPermit(true);
  }

  isProtectedOperationPermitActive(
    permit: ITravelModeProtectedOperationPermit,
  ): boolean {
    return this.activeOperationPermits.has(permit);
  }

  private createProtectedOperationPermit(
    tracked: boolean,
  ): ITravelModeProtectedOperationPermit {
    let released = false;
    const permit: ITravelModeProtectedOperationPermit = {
      id: Symbol('travel-mode-protected-operation'),
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.activeOperationPermits.delete(permit);
        if (!tracked) {
          return;
        }
        this.inFlightProtectedOperations -= 1;
        if (this.inFlightProtectedOperations === 0) {
          const waiters = [...this.drainWaiters];
          this.drainWaiters.clear();
          waiters.forEach((resolve) => resolve());
        }
      },
    };
    this.activeOperationPermits.add(permit);
    return permit;
  }

  async runProtectedOperation<T>({
    operation,
    onBlocked,
  }: {
    operation: () => Promise<T>;
    onBlocked: () => T | Promise<T>;
  }): Promise<T> {
    const release = await this.beginProtectedOperation();
    if (!release) {
      return onBlocked();
    }
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async transition({
    enabled,
    verifyString,
  }: {
    enabled: boolean;
    verifyString?: string;
  }): Promise<void> {
    await this.runSerialized(async () => {
      await this.ready;
      if (this.runtimeState === 'transition-recovery') {
        throw new OneKeyLocalError(
          'Travel Mode restart is required before another transition',
        );
      }
      if (this.runtimeState !== 'active' && this.runtimeState !== 'inactive') {
        throw new OneKeyLocalError('Travel Mode transition is already running');
      }
      const wasActive = this.runtimeState === 'active';
      if (enabled === wasActive) {
        return;
      }

      const priorRecord = this.controlRecord;
      let stateCommitted = false;
      this.runtimeState = enabled ? 'activating' : 'deactivating';
      try {
        if (!this.publishRuntimeMaskingState()) {
          throw new OneKeyLocalError(
            'Travel Mode runtime masking fence update failed',
          );
        }
        if (enabled) {
          await this.waitForProtectedOperationsToDrain();
        }
        const nextVerifyString = verifyString ?? priorRecord?.verifyString;
        if (!isValidVerifyString(nextVerifyString)) {
          throw new OneKeyLocalError(
            'Travel Mode passcode verifier is unavailable',
          );
        }
        const nextRecord: ITravelModeControlRecord = {
          enabled,
          verifyString: nextVerifyString,
          version: 1,
        };
        await this.persistAndVerify(nextRecord);
        stateCommitted = true;
        this.controlRecord = nextRecord;
        // The boot profile is immutable. A committed transition stays blocked
        // in this runtime until the replacement main/bg runtimes initialize
        // from the newly persisted profile.
        this.runtimeState = 'transition-recovery';
        if (!this.publishRuntimeMaskingState()) {
          throw new OneKeyLocalError(
            'Travel Mode runtime masking fence update failed',
          );
        }
      } catch (error) {
        if (stateCommitted) {
          this.runtimeState = 'transition-recovery';
          this.publishRuntimeMaskingState();
          throw error;
        }
        const restored = await this.tryRestoreRecord(priorRecord);
        if (!restored) {
          this.runtimeState = 'transition-recovery';
        } else {
          this.runtimeState = wasActive ? 'active' : 'inactive';
        }
        this.publishRuntimeMaskingState();
        throw error;
      }
    });
  }

  markRestartFailed() {
    if (this.supported) {
      this.runtimeState = 'transition-recovery';
      this.publishRuntimeMaskingState();
    }
  }

  private publishInitialRuntimeMaskingState(): Promise<void> {
    return new Promise((resolve) => {
      // iOS evaluates the complete background bundle before its native host
      // installs SharedStore. A task boundary lets that installation finish.
      setTimeout(() => {
        this.publishRuntimeMaskingState();
        resolve();
      }, 0);
    });
  }

  private publishRuntimeMaskingState(): boolean {
    try {
      this.storage.setRuntimeMaskingSync?.(this.runtimeState !== 'inactive');
      return true;
    } catch {
      this.runtimeState = 'transition-recovery';
      return false;
    }
  }

  private async runSerialized(task: () => Promise<void>): Promise<void> {
    const previous = this.transitionPromise;
    let release: (() => void) | undefined;
    this.transitionPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await task();
    } finally {
      release?.();
    }
  }

  private async persistAndVerify(record: ITravelModeControlRecord) {
    const serialized = JSON.stringify(record);
    await this.storage.setItem(serialized);
    const stored = await this.storage.getItem();
    const parsed = parseControlRecord(stored);
    if (
      !parsed ||
      parsed.enabled !== record.enabled ||
      parsed.verifyString !== record.verifyString
    ) {
      throw new OneKeyLocalError('Travel Mode state verification failed');
    }
  }

  private async tryRestoreRecord(
    record: ITravelModeControlRecord | null,
  ): Promise<boolean> {
    try {
      if (!record) {
        await this.storage.removeItem();
        const stored = await this.storage.getItem();
        if (stored !== null && stored !== undefined) {
          return false;
        }
        this.controlRecord = null;
        return true;
      }
      await this.persistAndVerify(record);
      this.controlRecord = record;
      return true;
    } catch {
      return false;
    }
  }

  private async waitForProtectedOperationsToDrain() {
    if (this.inFlightProtectedOperations === 0) {
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          this.drainWaiters.add(resolve);
        }),
        new Promise<void>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(
              new OneKeyLocalError('Travel Mode transition drain timed out'),
            );
          }, TRAVEL_MODE_TRANSITION_DRAIN_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  getInitializationErrorForDiagnostics(): unknown {
    return this.initializationError;
  }

  private buildRuntimeEnvironment(): IRuntimeEnvironment {
    return RuntimeEnvironment.create(this.runtimeProfile, {
      isBlockedSync: () => this.isMaskingDataSync(),
      runProtectedOperation: (operation) =>
        this.runProtectedOperation(operation),
    });
  }
}
