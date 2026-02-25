import ServiceDApp from './ServiceDApp';

describe('ServiceDApp', () => {
  let service: ServiceDApp;

  beforeEach(() => {
    service = new ServiceDApp({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceDApp({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceDApp);
    });
  });

  describe('dapp methods', () => {
    it('should have connectDApp method', () => {
      expect(typeof service.connectDApp).toBe('function');
    });

    it('should have disconnectDApp method', () => {
      expect(typeof service.disconnectDApp).toBe('function');
    });

    it('should have getDAppList method', () => {
      expect(typeof service.getDAppList).toBe('function');
    });

    it('should have approveDApp method', () => {
      expect(typeof service.approveDApp).toBe('function');
    });

    it('should have rejectDApp method', () => {
      expect(typeof service.rejectDApp).toBe('function');
    });
  });
});
