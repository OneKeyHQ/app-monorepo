/* eslint-disable spellcheck/spell-checker */
import {
  keychainGetItem,
  keychainHasItem,
  keychainIsICloudSyncEnabled,
  keychainRemoveItem,
  keychainSetItem,
} from '@onekeyfe/electron-mac-icloud';
import _logger from 'electron-log/main';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppleKeyChainStorage } from '@onekeyhq/shared/src/storage/AppleKeyChainStorage/types';

import type { IDesktopApi } from './instance/IDesktopApi';

export type IKeychainSetItemParams = {
  key: string;
  value: string;
  enableSync?: boolean; // Optional, defaults to true for iCloud sync
  label?: string; // Optional, friendly name displayed in Keychain Access app
  description?: string; // Optional, description for the keychain item
};

export type IKeychainGetItemParams = {
  key: string;
};

export type IKeychainGetItemResult = {
  key: string;
  value: string;
} | null;

export type IKeychainRemoveItemParams = {
  key: string;
};

export type IKeychainHasItemParams = {
  key: string;
};

/**
 * Desktop Keychain API - Secure Keychain access with app sandboxing and iCloud sync
 *
 * This implementation uses native Swift KeychainHelper which provides:
 * - TRUE app sandboxing via Bundle ID (other apps CANNOT access)
 * - iCloud Keychain synchronization for cross-device data sharing
 * - Full compatibility with iOS KeychainModule.swift
 *
 * Security Features:
 * ✅ Bundle ID-based app isolation (system-level security)
 * ✅ iCloud Keychain sync (automatically syncs to user's other Apple devices)
 * ✅ Compatible with iOS for seamless data sharing across Desktop and Mobile
 * ✅ Other applications CANNOT access these keychain items
 *
 * Platform Support:
 * - macOS: Full support with iCloud sync
 * - Windows/Linux: Not supported (throws error)
 *
 * Use Cases:
 * - Store encryption keys that need to sync across devices
 * - Share secure data between Desktop and iOS apps
 * - Backup/restore keys across user's Apple devices
 */
class DesktopApiKeychain implements IAppleKeyChainStorage {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  ensureMacOS() {
    if (process.platform !== 'darwin') {
      throw new OneKeyLocalError('Keychain is only available on macOS');
    }
  }

  /**
   * Store an item securely in Keychain with iCloud sync
   *
   * Data is stored with:
   * - Bundle ID-based app isolation (true sandboxing)
   * - iCloud Keychain sync enabled by default
   * - Accessible only when device is unlocked
   *
   * @param params.key - Keychain account identifier
   * @param params.value - Data to store (will be encrypted by macOS)
   * @param params.enableSync - Enable iCloud sync (default: true)
   * @returns Promise<boolean> - true if successful
   */
  async setItem(params: IKeychainSetItemParams): Promise<void> {
    this.ensureMacOS();
    return keychainSetItem(params);
  }

  /**
   * Retrieve a securely stored item from Keychain
   *
   * Queries both local and iCloud-synced items
   *
   * @param params.key - Keychain account identifier
   * @returns Promise<IKeychainGetItemResult | null> - The stored data or null if not found
   */
  async getItem(
    params: IKeychainGetItemParams,
  ): Promise<IKeychainGetItemResult> {
    this.ensureMacOS();
    return keychainGetItem({ key: params.key });
  }

  /**
   * Remove a securely stored item from Keychain
   *
   * Removes both local and iCloud-synced copies
   *
   * @param params.key - Keychain account identifier
   * @returns Promise<boolean> - true if successful
   */
  async removeItem(params: IKeychainRemoveItemParams): Promise<void> {
    this.ensureMacOS();
    return keychainRemoveItem({ key: params.key });
  }

  /**
   * Check if an item exists in Keychain
   *
   * @param params.key - Keychain account identifier
   * @returns Promise<boolean> - true if item exists
   */
  async hasItem(params: IKeychainHasItemParams): Promise<boolean> {
    this.ensureMacOS();
    return keychainHasItem({ key: params.key });
  }

  /**
   * Check if iCloud Keychain sync is enabled
   *
   * Tests if the system can create synchronizable keychain items.
   * Returns false if user is not signed in to iCloud or iCloud Keychain is disabled.
   *
   * @returns Promise<boolean> - true if iCloud Keychain sync is available
   */
  async isICloudSyncEnabled(): Promise<boolean> {
    this.ensureMacOS();
    return keychainIsICloudSyncEnabled();
  }
}

export default DesktopApiKeychain;
