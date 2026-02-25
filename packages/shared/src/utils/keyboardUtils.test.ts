import {
  isEnterKey,
  isEscapeKey,
  isTabKey,
  isArrowKey,
} from './keyboardUtils';

describe('keyboardUtils', () => {
  describe('isEnterKey', () => {
    it('should detect Enter key', () => {
      expect(isEnterKey({ key: 'Enter' } as KeyboardEvent)).toBe(true);
      expect(isEnterKey({ key: 'Escape' } as KeyboardEvent)).toBe(false);
    });
  });

  describe('isEscapeKey', () => {
    it('should detect Escape key', () => {
      expect(isEscapeKey({ key: 'Escape' } as KeyboardEvent)).toBe(true);
      expect(isEscapeKey({ key: 'Enter' } as KeyboardEvent)).toBe(false);
    });
  });

  describe('isTabKey', () => {
    it('should detect Tab key', () => {
      expect(isTabKey({ key: 'Tab' } as KeyboardEvent)).toBe(true);
    });
  });

  describe('isArrowKey', () => {
    it('should detect arrow keys', () => {
      expect(isArrowKey({ key: 'ArrowUp' } as KeyboardEvent)).toBe(true);
      expect(isArrowKey({ key: 'ArrowDown' } as KeyboardEvent)).toBe(true);
      expect(isArrowKey({ key: 'Enter' } as KeyboardEvent)).toBe(false);
    });
  });
});
