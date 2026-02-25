import {
  delay,
  timeout,
  retry,
  allSettled,
} from './promiseUtils';

describe('promiseUtils', () => {
  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('timeout', () => {
    it('should resolve before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await timeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject on timeout', async () => {
      const promise = new Promise(() => {}); // never resolves
      await expect(timeout(promise, 100)).rejects.toThrow();
    });
  });

  describe('retry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      };
      
      const result = await retry(fn, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const fn = () => { throw new Error('always fails'); };
      await expect(retry(fn, 3)).rejects.toThrow('always fails');
    });
  });

  describe('allSettled', () => {
    it('should wait for all promises', async () => {
      const promises = [
        Promise.resolve('success'),
        Promise.reject(new Error('fail')),
        Promise.resolve('another'),
      ];
      
      const results = await allSettled(promises);
      expect(results).toHaveLength(3);
    });
  });
});
