import {
  parseIpTable,
  getIpRegion,
  isIpInRange,
} from './ipTableUtils';

describe('ipTableUtils', () => {
  describe('parseIpTable', () => {
    it('should parse IP table correctly', () => {
      const ipTable = '192.168.1.0/24,US\n10.0.0.0/8,CN';
      const result = parseIpTable(ipTable);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty input', () => {
      const result = parseIpTable('');
      expect(result).toEqual([]);
    });
  });

  describe('getIpRegion', () => {
    it('should return region for known IP', () => {
      const ipTable = '192.168.1.0/24,US';
      const result = getIpRegion('192.168.1.100', ipTable);
      expect(result).toBe('US');
    });

    it('should return empty for unknown IP', () => {
      const ipTable = '192.168.1.0/24,US';
      const result = getIpRegion('10.0.0.1', ipTable);
      expect(result).toBe('');
    });
  });

  describe('isIpInRange', () => {
    it('should return true for IP in range', () => {
      const result = isIpInRange('192.168.1.100', '192.168.1.0/24');
      expect(result).toBe(true);
    });

    it('should return false for IP outside range', () => {
      const result = isIpInRange('10.0.0.1', '192.168.1.0/24');
      expect(result).toBe(false);
    });
  });
});
