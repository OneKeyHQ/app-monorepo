export type ITravelModeControlRecord = {
  enabled: boolean;
  verifyString: string;
  version: 1;
};

export interface ITravelModeControlStorage {
  getItem(): Promise<string | null | undefined>;
  getItemSync?(): string | null | undefined;
  removeItem(): Promise<void>;
  setItem(value: string): Promise<void>;
}

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
  IRuntimePersistenceCapability,
} from './runtimeEnvironment';
