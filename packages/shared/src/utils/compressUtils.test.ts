import {
  compress,
  decompress,
  gzip,
  gunzip,
} from './compressUtils';

describe('compressUtils', () => {
  describe('compress & decompress', () => {
    it('should compress and decompress data', () => {
      const data = 'Hello World! This is a test string.';
      const compressed = compress(data);
      const decompressed = decompress(compressed);
      expect(decompressed).toBe(data);
    });
  });

  describe('gzip & gunzip', () => {
    it('should gzip and gunzip data', () => {
      const data = 'Hello World!';
      const gzipped = gzip(data);
      const gunzipped = gunzip(gzipped);
      expect(gunzipped).toBe(data);
    });
  });
});
