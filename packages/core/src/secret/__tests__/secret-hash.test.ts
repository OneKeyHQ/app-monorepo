import { hmacSHA256, hmacSHA512, sha256, hash160 } from '../hash';

describe('Hash Functions', () => {
  describe('hmacSHA256', () => {
    it('should match snapshot', () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const result = hmacSHA256(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('');
      const result = hmacSHA256(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty key', () => {
      const key = Buffer.from('');
      const data = Buffer.from('test-data');
      const result = hmacSHA256(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('hmacSHA512', () => {
    it('should match snapshot', () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('test-data');
      const result = hmacSHA512(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', () => {
      const key = Buffer.from('test-key');
      const data = Buffer.from('');
      const result = hmacSHA512(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty key', () => {
      const key = Buffer.from('');
      const data = Buffer.from('test-data');
      const result = hmacSHA512(key, data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('sha256', () => {
    it('should match snapshot', () => {
      const data = Buffer.from('test-data');
      const result = sha256(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', () => {
      const data = Buffer.from('');
      const result = sha256(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });

  describe('hash160', () => {
    it('should match snapshot', () => {
      const data = Buffer.from('test-data');
      const result = hash160(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });

    it('should match snapshot with empty data', () => {
      const data = Buffer.from('');
      const result = hash160(data);
      expect(result.toString('hex')).toMatchSnapshot();
    });
  });
});
