import { OneKeyLocalError } from '../errors';

import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';

import type {
  IRuntimeEnvironment,
  ITravelModeControlRecord,
  ITravelModeControlStorage,
  ITravelModeRuntimeProfile,
  ITravelModeRuntimeState,
} from './types';

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
  private controlRecord: ITravelModeControlRecord | null = null;

  private initializationError: unknown;

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
      this.ready = Promise.resolve();
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
    return this.supported && this.runtimeProfile.persistence === 'masked';
  }

  async isActive(): Promise<boolean> {
    await this.ready;
    return this.runtimeProfile.kind === 'travel-mode';
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
      this.runtimeState = enabled ? 'activating' : 'deactivating';
      try {
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
        this.controlRecord = nextRecord;
        // The boot profile stays active until replacement main/bg runtimes
        // initialize from the newly persisted profile.
        this.runtimeState = 'transition-recovery';
      } catch (error) {
        const restored = await this.tryRestoreRecord(priorRecord);
        if (!restored) {
          this.runtimeState = 'transition-recovery';
        } else {
          this.runtimeState = wasActive ? 'active' : 'inactive';
        }
        throw error;
      }
    });
  }

  markRestartFailed() {
    if (this.supported) {
      this.runtimeState = 'transition-recovery';
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

  getInitializationErrorForDiagnostics(): unknown {
    return this.initializationError;
  }

  private buildRuntimeEnvironment(): IRuntimeEnvironment {
    return RuntimeEnvironment.create(this.runtimeProfile);
  }
}
