import { CoreChainApiBase } from './CoreChainApiBase';

describe('CoreChainApiBase', () => {
  let api: CoreChainApiBase;

  beforeEach(() => {
    api = new CoreChainApiBase();
  });

  describe('initialization', () => {
    it('should create CoreChainApiBase instance', () => {
      expect(api).toBeInstanceOf(CoreChainApiBase);
    });
  });

  describe('chain methods', () => {
    it('should have getChain method', () => {
      expect(typeof api.getChain).toBe('function');
    });

    it('should have getChainInfo method', () => {
      expect(typeof api.getChainInfo).toBe('function');
    });

    it('should have getChainId method', () => {
      expect(typeof api.getChainId).toBe('function');
    });
  });

  describe('account methods', () => {
    it('should have getAccount method', () => {
      expect(typeof api.getAccount).toBe('function');
    });

    it('should have getAccounts method', () => {
      expect(typeof api.getAccounts).toBe('function');
    });
  });

  describe('transaction methods', () => {
    it('should have buildTransaction method', () => {
      expect(typeof api.buildTransaction).toBe('function');
    });

    it('should have signTransaction method', () => {
      expect(typeof api.signTransaction).toBe('function');
    });

    it('should have broadcastTransaction method', () => {
      expect(typeof api.broadcastTransaction).toBe('function');
    });
  });
});
