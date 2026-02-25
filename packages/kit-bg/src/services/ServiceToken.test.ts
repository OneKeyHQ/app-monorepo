import ServiceToken from './ServiceToken';

describe('ServiceToken', () => {
  let service: ServiceToken;

  beforeEach(() => {
    service = new ServiceToken({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceToken({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceToken);
    });
  });

  describe('token methods', () => {
    it('should have getToken method', () => {
      expect(typeof service.getToken).toBe('function');
    });

    it('should have getTokens method', () => {
      expect(typeof service.getTokens).toBe('function');
    });

    it('should have fetchTokensDetails method', () => {
      expect(typeof service.fetchTokensDetails).toBe('function');
    });

    it('should have addToken method', () => {
      expect(typeof service.addToken).toBe('function');
    });

    it('should have removeToken method', () => {
      expect(typeof service.removeToken).toBe('function');
    });
  });
});
