import ServiceHistory from './ServiceHistory';

describe('ServiceHistory', () => {
  let service: ServiceHistory;

  beforeEach(() => {
    service = new ServiceHistory({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceHistory({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceHistory);
    });
  });

  describe('history methods', () => {
    it('should have getHistory method', () => {
      expect(typeof service.getHistory).toBe('function');
    });

    it('should have getLocalHistory method', () => {
      expect(typeof service.getLocalHistory).toBe('function');
    });

    it('should have fetchHistory method', () => {
      expect(typeof service.fetchHistory).toBe('function');
    });

    it('should have clearHistory method', () => {
      expect(typeof service.clearHistory).toBe('function');
    });
  });
});
