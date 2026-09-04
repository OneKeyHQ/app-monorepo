export type ITravelModeControlRecord = {
  enabled: boolean;
  verifyString: string;
  version: 1;
};

export interface ITravelModeControlStorage {
  getItem(): Promise<string | null | undefined>;
  getItemSync?(): string | null | undefined;
  getRuntimeMaskingSync?(): boolean | undefined;
  removeItem(): Promise<void>;
  setRuntimeMaskingSync?(masking: boolean): void;
  setItem(value: string): Promise<void>;
}

export type ITravelModeProtectedOperationPermit = {
  readonly id: symbol;
  release(): void;
};

export type ITravelModeRuntimeState =
  | 'initializing'
  | 'inactive'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'transition-recovery';

export type { ITravelModeRuntimeProfile } from './runtimeProfile';
export type {
  IRuntimeCommandCapability,
  IRuntimeEffectCapability,
  IRuntimeEnvironment,
  IRuntimeEnvironmentBarrier,
  IRuntimePersistenceCapability,
} from './runtimeEnvironment';
