import {
  encodeMessage,
  decodeMessage,
  isValidMessage,
} from './messageUtils';

describe('messageUtils', () => {
  describe('encodeMessage', () => {
    it('should encode string message', () => {
      const result = encodeMessage('Hello World');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should encode object message', () => {
      const message = { type: 'test', data: 'value' };
      const result = encodeMessage(JSON.stringify(message));
      expect(result).toBeDefined();
    });
  });

  describe('decodeMessage', () => {
    it('should decode encoded message', () => {
      const encoded = encodeMessage('Hello World');
      const result = decodeMessage(encoded);
      expect(result).toBe('Hello World');
    });

    it('should handle invalid input gracefully', () => {
      expect(() => decodeMessage('invalid')).toThrow();
    });
  });

  describe('isValidMessage', () => {
    it('should return true for valid message', () => {
      const encoded = encodeMessage('test');
      const result = isValidMessage(encoded);
      expect(result).toBe(true);
    });

    it('should return false for invalid message', () => {
      const result = isValidMessage('invalid');
      expect(result).toBe(false);
    });
  });
});
