import ServicePromise from './ServicePromise';

describe('ServicePromise', () => {
  let service: ServicePromise;

  beforeEach(() => {
    service = new ServicePromise({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServicePromise({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServicePromise);
    });
  });

  describe('promise methods', () => {
    it('should have createPromise method', () => {
      expect(typeof service.createPromise).toBe('function');
    });

    it('should have resolvePromise method', () => {
      expect(typeof service.resolvePromise).toBe('function');
    });

    it('should have rejectPromise method', () => {
      expect(typeof service.rejectPromise).toBe('function');
    });

    it('should have getPromise method', () => {
      expect(typeof service.getPromise).toBe('function');
    });

    it('should have removePromise method', () => {
      expect(typeof service.removePromise).toBe('function');
    });
  });
});
