import ServiceAccount from './ServiceAccount';

describe('ServiceAccount', () => {
  let service: ServiceAccount;

  beforeEach(() => {
    service = new ServiceAccount({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceAccount({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceAccount);
    });
  });

  describe('account methods', () => {
    it('should have getAccount method', () => {
      expect(typeof service.getAccount).toBe('function');
    });

    it('should have getAccounts method', () => {
      expect(typeof service.getAccounts).toBe('function');
    });

    it('should have addAccount method', () => {
      expect(typeof service.addAccount).toBe('function');
    });

    it('should have removeAccount method', () => {
      expect(typeof service.removeAccount).toBe('function');
    });

    it('should have updateAccount method', () => {
      expect(typeof service.updateAccount).toBe('function');
    });
  });
});
