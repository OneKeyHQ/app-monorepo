import ServiceGas from './ServiceGas';

describe('ServiceGas', () => {
  let service: ServiceGas;

  beforeEach(() => {
    service = new ServiceGas({ backgroundApi: {} as any });
  });

  describe('abortEstimateFee', () => {
    it('should abort estimate fee controller', () => {
      // Create a mock controller
      const mockController = { abort: jest.fn() };
      (service as any)._estimateFeeController = mockController;

      service.abortEstimateFee();

      expect(mockController.abort).toHaveBeenCalled();
      expect((service as any)._estimateFeeController).toBeNull();
    });

    it('should handle null controller gracefully', () => {
      (service as any)._estimateFeeController = null;

      expect(() => service.abortEstimateFee()).not.toThrow();
    });
  });

  describe('estimateFee', () => {
    it('should have estimateFee method', () => {
      expect(typeof service.estimateFee).toBe('function');
    });

    it('should have batchEstimateFee method', () => {
      expect(typeof service.batchEstimateFee).toBe('function');
    });

    it('should have abortEstimateFee method', () => {
      expect(typeof service.abortEstimateFee).toBe('function');
    });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceGas({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceGas);
    });

    it('should have null controller initially', () => {
      expect((service as any)._estimateFeeController).toBeNull();
    });
  });
});
