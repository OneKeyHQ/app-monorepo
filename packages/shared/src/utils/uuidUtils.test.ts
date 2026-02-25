import {
  generateUUID,
  generateShortUUID,
  isValidUUID,
  uuidToShort,
  shortToUuid,
} from './uuidUtils';

describe('uuidUtils', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID', () => {
      const result = generateUUID();
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateShortUUID', () => {
    it('should generate short UUID', () => {
      const result = generateShortUUID();
      expect(result.length).toBeLessThan(36);
    });
  });

  describe('isValidUUID', () => {
    it('should validate UUID format', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('invalid')).toBe(false);
    });
  });

  describe('uuidToShort & shortToUuid', () => {
    it('should convert UUID to short and back', () => {
      const uuid = generateUUID();
      const short = uuidToShort(uuid);
      const back = shortToUuid(short);
      expect(back).toBe(uuid);
    });
  });
});
