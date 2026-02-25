import {
  SEARCH_KEY_MIN_LENGTH,
  WALLET_NAME_MAX_LENGTH,
} from './walletConsts';

describe('Consts', () => {
  describe('walletConsts', () => {
    it('should have SEARCH_KEY_MIN_LENGTH', () => {
      expect(SEARCH_KEY_MIN_LENGTH).toBeDefined();
      expect(typeof SEARCH_KEY_MIN_LENGTH).toBe('number');
    });

    it('should have WALLET_NAME_MAX_LENGTH', () => {
      expect(WALLET_NAME_MAX_LENGTH).toBeDefined();
      expect(typeof WALLET_NAME_MAX_LENGTH).toBe('number');
    });
  });
});
