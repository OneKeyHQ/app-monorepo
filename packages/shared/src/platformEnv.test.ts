import platformEnv from './platformEnv';

describe('platformEnv', () => {
  describe('platform detection', () => {
    it('should detect platform', () => {
      expect(typeof platformEnv.isNative).toBe('boolean');
      expect(typeof platformEnv.isDesktop).toBe('boolean');
      expect(typeof platformEnv.isExtension).toBe('boolean');
      expect(typeof platformEnv.isWeb).toBe('boolean');
    });

    it('should detect OS', () => {
      expect(typeof platformEnv.isIOS).toBe('boolean');
      expect(typeof platformEnv.isAndroid).toBe('boolean');
      expect(typeof platformEnv.isMacOS).toBe('boolean');
      expect(typeof platformEnv.isWindows).toBe('boolean');
      expect(typeof platformEnv.isLinux).toBe('boolean');
    });

    it('should detect runtime', () => {
      expect(typeof platformEnv.isDev).toBe('boolean');
      expect(typeof platformEnv.isProduction).toBe('boolean');
    });
  });
});
