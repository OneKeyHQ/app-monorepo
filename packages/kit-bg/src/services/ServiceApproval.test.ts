import ServiceApproval from './ServiceApproval';

describe('ServiceApproval', () => {
  let service: ServiceApproval;

  beforeEach(() => {
    service = new ServiceApproval({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceApproval({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceApproval);
    });
  });

  describe('approval methods', () => {
    it('should have getApproval method', () => {
      expect(typeof service.getApproval).toBe('function');
    });

    it('should have addApproval method', () => {
      expect(typeof service.addApproval).toBe('function');
    });

    it('should have removeApproval method', () => {
      expect(typeof service.removeApproval).toBe('function');
    });

    it('should have resolveApproval method', () => {
      expect(typeof service.resolveApproval).toBe('function');
    });

    it('should have rejectApproval method', () => {
      expect(typeof service.rejectApproval).toBe('function');
    });
  });
});
