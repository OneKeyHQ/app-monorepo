import {
  hash160,
  hash160Sync,
  hmacSHA256,
  hmacSHA512,
  hmacSHA512Sync,
  sha256,
} from '../hash';

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
      await expect(hmacSHA256(key, data)).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should throw error with both empty key and data', async () => {
      const key = Buffer.from('');
      const data = Buffer.from('');
      await expect(hmacSHA256(key, data)).rejects.toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should handle null or undefined parameters', async () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');

      await expect(hmacSHA256(null as any, validData)).rejects.toThrow();
      await expect(hmacSHA256(undefined as any, validData)).rejects.toThrow();
      await expect(hmacSHA256(validKey, null as any)).rejects.toThrow();
      await expect(hmacSHA256(validKey, undefined as any)).rejects.toThrow();
      await expect(hmacSHA256(null as any, null as any)).rejects.toThrow();
      await expect(
        hmacSHA256(undefined as any, undefined as any),
      ).rejects.toThrow();
    });

    it('should handle large data input', async () => {
      const key = Buffer.from('test-key');
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = await hmacSHA256(key, largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(32); // SHA256 produces 32 bytes
    });

    it('should handle empty Buffer parameters', async () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(hmacSHA256(emptyBuffer, validData)).rejects.toThrow(
        'Zero-length key is not supported',
      );

      await expect(hmacSHA256(Buffer.from(''), validData)).rejects.toThrow(
        'Zero-length key is not supported',
      );

      await expect(hmacSHA256(validKey, emptyBuffer)).rejects.toThrow(
        'Zero-length data is not supported',
      );

      await expect(hmacSHA256(validKey, Buffer.from(''))).rejects.toThrow(
        'Zero-length data is not supported',
      );
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
      await expect(hmacSHA512(key, data)).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should throw error with both empty key and data', async () => {
      const key = Buffer.from('');
      const data = Buffer.from('');
      await expect(hmacSHA512(key, data)).rejects.toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should handle large data input', async () => {
      const key = Buffer.from('test-key');
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = await hmacSHA512(key, largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(64); // SHA512 produces 64 bytes
    });

    it('should handle null or undefined parameters', async () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');

      await expect(hmacSHA512(null as any, validData)).rejects.toThrow();
      await expect(hmacSHA512(undefined as any, validData)).rejects.toThrow();
      await expect(hmacSHA512(validKey, null as any)).rejects.toThrow();
      await expect(hmacSHA512(validKey, undefined as any)).rejects.toThrow();
      await expect(hmacSHA512(null as any, null as any)).rejects.toThrow();
      await expect(
        hmacSHA512(undefined as any, undefined as any),
      ).rejects.toThrow();
    });

    it('should handle empty Buffer parameters', async () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      await expect(hmacSHA512(emptyBuffer, validData)).rejects.toThrow(
        'Zero-length key is not supported',
      );

      await expect(hmacSHA512(Buffer.from(''), validData)).rejects.toThrow(
        'Zero-length key is not supported',
      );

      await expect(hmacSHA512(validKey, emptyBuffer)).rejects.toThrow(
        'Zero-length data is not supported',
      );

      await expect(hmacSHA512(validKey, Buffer.from(''))).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });
  });

  describe('hmacSHA512Sync', () => {
    it('should match with async method', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const result = hmacSHA512Sync(key, data);
      const asyncResult = await hmacSHA512(key, data);
      expect(result.toString('hex')).toEqual(asyncResult.toString('hex'));
    });

    it('should handle empty data', () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('');
      expect(() => hmacSHA512Sync(key, data)).toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should throw error with empty key', () => {
      const key = Buffer.from('');
      const data = Buffer.from('test-data');
      expect(() => hmacSHA512Sync(key, data)).toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should throw error with both empty key and data', () => {
      const key = Buffer.from('');
      const data = Buffer.from('');
      expect(() => hmacSHA512Sync(key, data)).toThrow(
        'Zero-length key is not supported',
      );
    });

    it('should handle large data input', () => {
      const key = Buffer.from('test-key');
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = hmacSHA512Sync(key, largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(64);
    });

    it('should handle null or undefined parameters', () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');

      expect(() => hmacSHA512Sync(null as any, validData)).toThrow();
      expect(() => hmacSHA512Sync(undefined as any, validData)).toThrow();
      expect(() => hmacSHA512Sync(validKey, null as any)).toThrow();
      expect(() => hmacSHA512Sync(validKey, undefined as any)).toThrow();
      expect(() => hmacSHA512Sync(null as any, null as any)).toThrow();
      expect(() =>
        hmacSHA512Sync(undefined as any, undefined as any),
      ).toThrow();
    });

    it('should handle empty Buffer parameters', () => {
      const validKey = Buffer.from('test-key');
      const validData = Buffer.from('test-data');
      const emptyBuffer = Buffer.alloc(0);

      expect(() => hmacSHA512Sync(emptyBuffer, validData)).toThrow(
        'Zero-length key is not supported',
      );

      expect(() => hmacSHA512Sync(Buffer.from(''), validData)).toThrow(
        'Zero-length key is not supported',
      );

      expect(() => hmacSHA512Sync(validKey, emptyBuffer)).toThrow(
        'Zero-length data is not supported',
      );

      expect(() => hmacSHA512Sync(validKey, Buffer.from(''))).toThrow(
        'Zero-length data is not supported',
      );
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
      await expect(sha256(data)).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should handle large data input', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = await sha256(largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(32); // SHA256 produces 32 bytes
    });

    it('should handle null or undefined data', async () => {
      await expect(sha256(null as any)).rejects.toThrow();
      await expect(sha256(undefined as any)).rejects.toThrow();
    });

    it('should handle empty Buffer input', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(sha256(emptyBuffer)).rejects.toThrow(
        'Zero-length data is not supported',
      );

      await expect(sha256(Buffer.from(''))).rejects.toThrow(
        'Zero-length data is not supported',
      );
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
      await expect(hash160(data)).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should handle large data input', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = await hash160(largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(20); // RIPEMD160 produces 20 bytes
    });

    it('should handle null or undefined data', async () => {
      await expect(hash160(null as any)).rejects.toThrow();
      await expect(hash160(undefined as any)).rejects.toThrow();
    });

    it('should handle empty Buffer input', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(hash160(emptyBuffer)).rejects.toThrow(
        'Zero-length data is not supported',
      );

      await expect(hash160(Buffer.from(''))).rejects.toThrow(
        'Zero-length data is not supported',
      );
    });
  });

  describe('hash160Sync', () => {
    it('should match with async method', async () => {
      const data = Buffer.from('test-data');
      const result = hash160Sync(data);
      const asyncResult = await hash160(data);
      expect(result.toString('hex')).toEqual(asyncResult.toString('hex'));
    });

    it('should handle empty data', () => {
      const data = Buffer.from('');
      expect(() => hash160Sync(data)).toThrow(
        'Zero-length data is not supported',
      );
    });

    it('should handle large data input', () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB of data
      const result = hash160Sync(largeData);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(20);
    });

    it('should handle null or undefined data', () => {
      expect(() => hash160Sync(null as any)).toThrow();
      expect(() => hash160Sync(undefined as any)).toThrow();
    });

    it('should handle empty Buffer input', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => hash160Sync(emptyBuffer)).toThrow(
        'Zero-length data is not supported',
      );

      expect(() => hash160Sync(Buffer.from(''))).toThrow(
        'Zero-length data is not supported',
      );
    });
  });

  describe('Performance Tests', () => {
    const ITERATIONS = 1000;
    const testData = Buffer.from('test-data');
    const testKey = Buffer.from('test-key');

    it('should compare hmacSHA512 sync vs async performance', async () => {
      const syncStart = performance.now();
      for (let i = 0; i < ITERATIONS; i += 1) {
        hmacSHA512Sync(testKey, testData);
      }
      const syncEnd = performance.now();
      const syncTime = syncEnd - syncStart;

      const asyncStart = performance.now();
      for (let i = 0; i < ITERATIONS; i += 1) {
        await hmacSHA512(testKey, testData);
      }
      const asyncEnd = performance.now();
      const asyncTime = asyncEnd - asyncStart;

      console.log(`HMAC-SHA512 Sync time: ${syncTime}ms`);
      console.log(`HMAC-SHA512 Async time: ${asyncTime}ms`);
    });

    it('should compare hash160 sync vs async performance', async () => {
      const syncStart = performance.now();
      for (let i = 0; i < ITERATIONS; i += 1) {
        hash160Sync(testData);
      }
      const syncEnd = performance.now();
      const syncTime = syncEnd - syncStart;

      const asyncStart = performance.now();
      for (let i = 0; i < ITERATIONS; i += 1) {
        await hash160(testData);
      }
      const asyncEnd = performance.now();
      const asyncTime = asyncEnd - asyncStart;

      console.log(`Hash160 Sync time: ${syncTime}ms`);
      console.log(`Hash160 Async time: ${asyncTime}ms`);
    });
  });

  describe('Concurrent Tests', () => {
    it('should handle concurrent hmacSHA512Sync calls', async () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const promises = Array(10)
        .fill(null)
        .map(async () => {
          const result = hmacSHA512Sync(key, data);
          const asyncResult = await hmacSHA512(key, data);
          expect(result.toString('hex')).toEqual(asyncResult.toString('hex'));
        });
      await Promise.all(promises);
    });

    it('should handle concurrent hash160Sync calls', async () => {
      const data = Buffer.from('test-data');
      const promises = Array(10)
        .fill(null)
        .map(async () => {
          const result = hash160Sync(data);
          const asyncResult = await hash160(data);
          expect(result.toString('hex')).toEqual(asyncResult.toString('hex'));
        });
      await Promise.all(promises);
    });
  });
});
