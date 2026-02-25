import ServiceHardware from './ServiceHardware';

describe('ServiceHardware', () => {
  let service: ServiceHardware;

  beforeEach(() => {
    service = new ServiceHardware({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceHardware({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceHardware);
    });
  });

  describe('hardware methods', () => {
    it('should have getHardwareInfo method', () => {
      expect(typeof service.getHardwareInfo).toBe('function');
    });

    it('should have connectHardware method', () => {
      expect(typeof service.connectHardware).toBe('function');
    });

    it('should have disconnectHardware method', () => {
      expect(typeof service.disconnectHardware).toBe('function');
    });

    it('should have verifyHardware method', () => {
      expect(typeof service.verifyHardware).toBe('function');
    });

    it('should have updateFirmware method', () => {
      expect(typeof service.updateFirmware).toBe('function');
    });
  });
});
