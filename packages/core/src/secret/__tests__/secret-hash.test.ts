import { hash160, hmacSHA256, hmacSHA512, sha256 } from '../hash';

/*
yarn jest packages/core/src/secret/__tests__/secret-hash.test.ts
*/

describe('Hash Functions', () => {
  describe('hmacSHA256', () => {
    it('should match snapshot', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const result = await hmacSHA256(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty key', async () => {
      const key = Buffer.from('');
      const data = Buffer.from('test-data');
      await expect(hmacSHA256(key, data)).rejects.toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should match snapshot with empty data', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('');
      const result = await hmacSHA256(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('hmacSHA512', () => {
    it('should match snapshot', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const result = await hmacSHA512(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty key', async () => {
      const key = Buffer.from('');
      const data = Buffer.from('test-data');
      await expect(hmacSHA512(key, data)).rejects.toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should match snapshot with empty data', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('');
      const result = await hmacSHA512(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('sha256', () => {
    it('should match snapshot', async () => {
      const data = Buffer.from('test-data');
      const result = await sha256(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', async () => {
      const data = Buffer.from('');
      const result = await sha256(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('hash160', () => {
    it('should match snapshot', async () => {
      const data = Buffer.from('test-data');
      const result = await hash160(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', async () => {
      const data = Buffer.from('');
      const result = await hash160(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });
});
