import {
  copyToClipboard,
  readFromClipboard,
} from './clipboardUtils';

describe('clipboardUtils', () => {
  describe('copyToClipboard', () => {
    it('should have copyToClipboard method', () => {
      expect(typeof copyToClipboard).toBe('function');
    });
  });

  describe('readFromClipboard', () => {
    it('should have readFromClipboard method', () => {
      expect(typeof readFromClipboard).toBe('function');
    });
  });
});
