import { Platform } from 'react-native';
import LaunchOptionsManagerNative from './LaunchOptionsManager.native';

interface LaunchOptionsManagerInterface {
  getLaunchOptions(): Promise<Record<string, any> | null>;
  clearLaunchOptions(): Promise<boolean>;
}

const LaunchOptionsManager = LaunchOptionsManagerNative;

class LaunchOptionsManagerModule {
  private static instance: LaunchOptionsManagerModule;
  private launchOptions: Record<string, any> | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): LaunchOptionsManagerModule {
    if (!LaunchOptionsManagerModule.instance) {
      LaunchOptionsManagerModule.instance = new LaunchOptionsManagerModule();
    }
    return LaunchOptionsManagerModule.instance;
  }

  /**
   * Get launch options from native module
   * Only available on iOS
   */
  public async getLaunchOptions(): Promise<Record<string, any> | null> {
    if (Platform.OS !== 'ios') {
      console.warn('LaunchOptionsManager is only available on iOS');
      return null;
    }

    if (!LaunchOptionsManager) {
      console.warn('LaunchOptionsManager native module not found');
      return null;
    }

    try {
      const result = await LaunchOptionsManager.getLaunchOptions();
      this.launchOptions = result;
      this.isInitialized = true;
      return result;
    } catch (error) {
      console.error('Failed to get launch options:', error);
      return null;
    }
  }

  /**
   * Clear stored launch options
   * Only available on iOS
   */
  public async clearLaunchOptions(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('LaunchOptionsManager is only available on iOS');
      return false;
    }

    if (!LaunchOptionsManager) {
      console.warn('LaunchOptionsManager native module not found');
      return false;
    }

    try {
      const result = await LaunchOptionsManager.clearLaunchOptions();
      this.launchOptions = null;
      return result;
    } catch (error) {
      console.error('Failed to clear launch options:', error);
      return false;
    }
  }

  /**
   * Get cached launch options (synchronous)
   * Returns null if not initialized
   */
  public getCachedLaunchOptions(): Record<string, any> | null {
    return this.launchOptions;
  }

  /**
   * Check if launch options have been initialized
   */
  public isLaunchOptionsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize and get launch options in one call
   * This is the recommended way to get launch options
   */
  public async initializeAndGetLaunchOptions(): Promise<Record<string, any> | null> {
    if (!this.isInitialized) {
      return await this.getLaunchOptions();
    }
    return this.launchOptions;
  }
}

export const launchOptionsManager = LaunchOptionsManagerModule.getInstance();

export default launchOptionsManager;
