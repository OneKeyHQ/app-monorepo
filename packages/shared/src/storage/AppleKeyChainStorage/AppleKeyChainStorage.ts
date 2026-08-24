import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import KeychainModule from './keychainModule';

import type {
  IAppleKeyChainNativeModule,
  IAppleKeyChainStorage,
} from './types';

export class AppleKeyChainStorage implements IAppleKeyChainStorage {
  private getKeychainModule(): IAppleKeyChainNativeModule {
    if (platformEnv.isNativeIOS) {
      return KeychainModule;
    }
    if (platformEnv.isDesktopMac) {
      return desktopApiProxy.keychain;
    }
    throw new OneKeyLocalError('Failed to load Keychain module');
  }

  async setItem({
    key,
    value,
    enableSync,
    label,
    description,
  }: {
    key: string;
    value: string;
    enableSync?: boolean;
    label?: string;
    description?: string;
  }): Promise<void> {
    const keychainModule = this.getKeychainModule();
    await keychainModule.setItem({
      key,
      value,
      // Default iCloud sync OFF (opt-in) here in the shared layer so the
      // default is identical across platforms. Otherwise omitting enableSync
      // would yield false on desktop (DesktopApiKeychain defaults it) but the
      // iOS native module's own default (true) on iOS — a platform asymmetry.
      enableSync: enableSync ?? false,
      label,
      description,
    });
  }

  async getItem({
    key,
  }: {
    key: string;
  }): Promise<{ value: string; key: string } | null> {
    const keychainModule = this.getKeychainModule();
    const result = await keychainModule.getItem({ key });
    return result;
  }

  async removeItem({ key }: { key: string }): Promise<void> {
    const keychainModule = this.getKeychainModule();
    await keychainModule.removeItem({ key });
  }

  async hasItem({ key }: { key: string }): Promise<boolean> {
    const keychainModule = this.getKeychainModule();
    return keychainModule.hasItem({ key });
  }

  async isICloudSyncEnabled(): Promise<boolean> {
    const keychainModule = this.getKeychainModule();
    return keychainModule.isICloudSyncEnabled();
  }
}
