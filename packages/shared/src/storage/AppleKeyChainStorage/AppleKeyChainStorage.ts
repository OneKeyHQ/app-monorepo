import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  IAppleKeyChainNativeModule,
  IAppleKeyChainStorage,
} from './types';

export class AppleKeyChainStorage implements IAppleKeyChainStorage {
  private getKeychainModule(): IAppleKeyChainNativeModule {
    if (platformEnv.isNativeIOS) {
      const m = NativeModules?.KeychainModule;
      if (!m) {
        throw new OneKeyLocalError('Keychain native module not found');
      }
      return m;
    }
    if (platformEnv.isDesktopMac) {
      return desktopApiProxy.keychain;
    }
    throw new OneKeyLocalError('Failed to load Keychain module');
  }

  async setItem({
    key,
    value,
    label,
    description,
  }: {
    key: string;
    value: string;
    label?: string;
    description?: string;
  }): Promise<void> {
    const keychainModule = this.getKeychainModule();
    await keychainModule.setItem({ key, value, label, description });
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
