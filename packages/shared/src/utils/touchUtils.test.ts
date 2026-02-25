import {
  getTouchPosition,
  isMultiTouch,
  getPinchDistance,
} from './touchUtils';

describe('touchUtils', () => {
  describe('getTouchPosition', () => {
    it('should have getTouchPosition method', () => {
      expect(typeof getTouchPosition).toBe('function');
    });
  });

  describe('isMultiTouch', () => {
    it('should have isMultiTouch method', () => {
      expect(typeof isMultiTouch).toBe('function');
    });
  });

  describe('getPinchDistance', () => {
    it('should have getPinchDistance method', () => {
      expect(typeof getPinchDistance).toBe('function');
    });
  });
});
