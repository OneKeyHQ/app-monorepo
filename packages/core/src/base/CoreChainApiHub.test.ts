import { CoreChainApiHub } from './CoreChainApiHub';

describe('CoreChainApiHub', () => {
  let hub: CoreChainApiHub;

  beforeEach(() => {
    hub = new CoreChainApiHub();
  });

  describe('initialization', () => {
    it('should create CoreChainApiHub instance', () => {
      expect(hub).toBeInstanceOf(CoreChainApiHub);
    });
  });

  describe('hub methods', () => {
    it('should have getHub method', () => {
      expect(typeof hub.getHub).toBe('function');
    });

    it('should have register method', () => {
      expect(typeof hub.register).toBe('function');
    });

    it('should have unregister method', () => {
      expect(typeof hub.unregister).toBe('function');
    });
  });

  describe('chain api management', () => {
    it('should have getChainApi method', () => {
      expect(typeof hub.getChainApi).toBe('function');
    });

    it('should have getAllChainApis method', () => {
      expect(typeof hub.getAllChainApis).toBe('function');
    });
  });
});
