import {
  isWebEmbed,
  getWebEmbedConfig,
} from './webEmbedUtils';

describe('webEmbedUtils', () => {
  describe('isWebEmbed', () => {
    it('should detect web embed environment', () => {
      const result = isWebEmbed();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getWebEmbedConfig', () => {
    it('should have getWebEmbedConfig method', () => {
      expect(typeof getWebEmbedConfig).toBe('function');
    });
  });
});
