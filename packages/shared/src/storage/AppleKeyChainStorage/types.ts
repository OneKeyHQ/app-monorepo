export interface IAppleKeyChainNativeModule {
  /**
   * Set an item in the iOS Keychain
   * @param params Object containing key, value, and optional display attributes
   * @param params.key The keychain key (account identifier)
   * @param params.value The value to store
   * @param params.label Optional label displayed in Keychain Access app
   * @param params.description Optional description for the keychain item
   * @returns Promise that resolves when the item is stored
   */
  setItem(params: {
    key: string;
    value: string;
    label?: string;
    description?: string;
  }): Promise<void>;

  /**
   * Get an item from the iOS Keychain
   * @param params Object containing key
   * @returns Promise resolving to object with value and key or null if not found
   */
  getItem(params: {
    key: string;
  }): Promise<{ value: string; key: string } | null>;

  /**
   * Remove an item from the iOS Keychain
   * @param params Object containing key
   * @returns Promise that resolves when the item is removed
   */
  removeItem(params: { key: string }): Promise<void>;

  /**
   * Check if an item exists in the iOS Keychain
   * @param params Object containing key
   * @returns Promise resolving to true if the item exists
   */
  hasItem(params: { key: string }): Promise<boolean>;

  /**
   * Check if iCloud Keychain sync is enabled
   * @returns Promise resolving to true if iCloud Keychain sync is enabled
   */
  isICloudSyncEnabled(): Promise<boolean>;
}

export type IAppleKeyChainStorage = IAppleKeyChainNativeModule;
