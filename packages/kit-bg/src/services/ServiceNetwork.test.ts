import ServiceNetwork from './ServiceNetwork';

describe('ServiceNetwork', () => {
  let service: ServiceNetwork;

  beforeEach(() => {
    service = new ServiceNetwork({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceNetwork({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceNetwork);
    });
  });

  describe('network methods', () => {
    it('should have getNetwork method', () => {
      expect(typeof service.getNetwork).toBe('function');
    });

    it('should have getNetworks method', () => {
      expect(typeof service.getNetworks).toBe('function');
    });

    it('should have getAllNetworks method', () => {
      expect(typeof service.getAllNetworks).toBe('function');
    });

    it('should have getNetworkIds method', () => {
      expect(typeof service.getNetworkIds).toBe('function');
    });
  });
});
