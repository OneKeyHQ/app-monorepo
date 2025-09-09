import { Platform } from 'react-native';
import { launchOptionsManager } from './LaunchOptionsManager';

// Mock the native module
jest.mock('./LaunchOptionsManager.native', () => ({
  getLaunchOptions: jest.fn(),
  clearLaunchOptions: jest.fn(),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('LaunchOptionsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLaunchOptions', () => {
    it('should return launch options on iOS', async () => {
      const mockLaunchOptions = {
        UIApplicationLaunchOptionsURLKey: 'onekey://test',
      };

      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockResolvedValue(mockLaunchOptions);

      const result = await launchOptionsManager.getLaunchOptions();

      expect(result).toEqual(mockLaunchOptions);
      expect(LaunchOptionsManagerNative.getLaunchOptions).toHaveBeenCalledTimes(1);
    });

    it('should return null on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';

      const result = await launchOptionsManager.getLaunchOptions();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockRejectedValue(new Error('Test error'));

      const result = await launchOptionsManager.getLaunchOptions();

      expect(result).toBeNull();
    });
  });

  describe('clearLaunchOptions', () => {
    it('should clear launch options on iOS', async () => {
      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.clearLaunchOptions as jest.Mock).mockResolvedValue(true);

      const result = await launchOptionsManager.clearLaunchOptions();

      expect(result).toBe(true);
      expect(LaunchOptionsManagerNative.clearLaunchOptions).toHaveBeenCalledTimes(1);
    });

    it('should return false on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';

      const result = await launchOptionsManager.clearLaunchOptions();

      expect(result).toBe(false);
    });
  });

  describe('getCachedLaunchOptions', () => {
    it('should return cached launch options', async () => {
      const mockLaunchOptions = {
        UIApplicationLaunchOptionsURLKey: 'onekey://test',
      };

      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockResolvedValue(mockLaunchOptions);

      // First call to initialize
      await launchOptionsManager.getLaunchOptions();

      // Second call should return cached value
      const cachedResult = launchOptionsManager.getCachedLaunchOptions();

      expect(cachedResult).toEqual(mockLaunchOptions);
    });

    it('should return null if not initialized', () => {
      const result = launchOptionsManager.getCachedLaunchOptions();

      expect(result).toBeNull();
    });
  });

  describe('isLaunchOptionsInitialized', () => {
    it('should return false initially', () => {
      expect(launchOptionsManager.isLaunchOptionsInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      const mockLaunchOptions = {
        UIApplicationLaunchOptionsURLKey: 'onekey://test',
      };

      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockResolvedValue(mockLaunchOptions);

      await launchOptionsManager.getLaunchOptions();

      expect(launchOptionsManager.isLaunchOptionsInitialized()).toBe(true);
    });
  });

  describe('initializeAndGetLaunchOptions', () => {
    it('should initialize and return launch options', async () => {
      const mockLaunchOptions = {
        UIApplicationLaunchOptionsURLKey: 'onekey://test',
      };

      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockResolvedValue(mockLaunchOptions);

      const result = await launchOptionsManager.initializeAndGetLaunchOptions();

      expect(result).toEqual(mockLaunchOptions);
      expect(launchOptionsManager.isLaunchOptionsInitialized()).toBe(true);
    });

    it('should return cached value if already initialized', async () => {
      const mockLaunchOptions = {
        UIApplicationLaunchOptionsURLKey: 'onekey://test',
      };

      const { default: LaunchOptionsManagerNative } = await import('./LaunchOptionsManager.native');
      (LaunchOptionsManagerNative.getLaunchOptions as jest.Mock).mockResolvedValue(mockLaunchOptions);

      // First call to initialize
      await launchOptionsManager.getLaunchOptions();

      // Second call should return cached value without calling native module
      const result = await launchOptionsManager.initializeAndGetLaunchOptions();

      expect(result).toEqual(mockLaunchOptions);
      expect(LaunchOptionsManagerNative.getLaunchOptions).toHaveBeenCalledTimes(1);
    });
  });
});
