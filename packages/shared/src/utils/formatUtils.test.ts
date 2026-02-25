import {
  formatAddress,
  formatTxId,
  formatDateTime,
  formatDuration,
} from './formatUtils';

describe('formatUtils', () => {
  describe('formatAddress', () => {
    it('should format address with ellipsis', () => {
      const result = formatAddress('0x1234567890abcdef');
      expect(result).toContain('...');
    });

    it('should return full address if short', () => {
      const result = formatAddress('0x1234');
      expect(result).toBe('0x1234');
    });
  });

  describe('formatTxId', () => {
    it('should format transaction ID', () => {
      const result = formatTxId('0x1234567890abcdef');
      expect(result).toContain('...');
    });
  });

  describe('formatDateTime', () => {
    it('should format date time', () => {
      const result = formatDateTime(new Date('2024-01-15 10:30'));
      expect(result).toContain('2024');
    });
  });

  describe('formatDuration', () => {
    it('should format duration in seconds', () => {
      const result = formatDuration(65);
      expect(result).toContain('1');
    });
  });
});
