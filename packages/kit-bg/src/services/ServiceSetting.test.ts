import ServiceSetting from './ServiceSetting';

describe('ServiceSetting', () => {
  let service: ServiceSetting;

  beforeEach(() => {
    service = new ServiceSetting({ backgroundApi: {} as any });
  });

  describe('service initialization', () => {
    it('should initialize with backgroundApi', () => {
      const mockBackgroundApi = { test: 'value' };
      const newService = new ServiceSetting({ backgroundApi: mockBackgroundApi as any });
      expect(newService).toBeInstanceOf(ServiceSetting);
    });
  });

  describe('setting methods', () => {
    it('should have getSetting method', () => {
      expect(typeof service.getSetting).toBe('function');
    });

    it('should have setSetting method', () => {
      expect(typeof service.setSetting).toBe('function');
    });

    it('should have getLocale method', () => {
      expect(typeof service.getLocale).toBe('function');
    });

    it('should have setLocale method', () => {
      expect(typeof service.setLocale).toBe('function');
    });

    it('should have getTheme method', () => {
      expect(typeof service.getTheme).toBe('function');
    });

    it('should have setTheme method', () => {
      expect(typeof service.setTheme).toBe('function');
    });
  });
});
