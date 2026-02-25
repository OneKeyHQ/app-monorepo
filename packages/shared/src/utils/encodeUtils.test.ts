import {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  htmlEncode,
  htmlDecode,
} from './encodeUtils';

describe('encodeUtils', () => {
  describe('base64Encode & base64Decode', () => {
    it('should encode and decode base64', () => {
      const data = 'Hello World!';
      const encoded = base64Encode(data);
      const decoded = base64Decode(encoded);
      expect(decoded).toBe(data);
    });
  });

  describe('urlEncode & urlDecode', () => {
    it('should encode and decode URL', () => {
      const data = 'Hello World!';
      const encoded = urlEncode(data);
      const decoded = urlDecode(encoded);
      expect(decoded).toBe(data);
    });
  });

  describe('htmlEncode & htmlDecode', () => {
    it('should encode and decode HTML', () => {
      const data = '<div>Hello</div>';
      const encoded = htmlEncode(data);
      const decoded = htmlDecode(encoded);
      expect(decoded).toBe(data);
    });
  });
});
