import { Kit } from './Kit';

describe('Kit', () => {
  describe('Kit component', () => {
    it('should have Kit export', () => {
      expect(Kit).toBeDefined();
    });

    it('should be a valid component', () => {
      expect(typeof Kit).toBe('function');
    });
  });
});
