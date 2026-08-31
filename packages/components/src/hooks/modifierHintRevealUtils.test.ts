/**
 * @jest-environment jsdom
 */

import {
  isEditableFocused,
  isPrimaryModifierHeld,
  isPrimaryModifierKeyEvent,
  shouldCancelModifierHintReveal,
} from './modifierHintRevealUtils';

describe('modifierHintRevealUtils', () => {
  describe('isPrimaryModifierKeyEvent', () => {
    it('detects Meta on Apple desktop', () => {
      expect(
        isPrimaryModifierKeyEvent(
          new KeyboardEvent('keydown', { key: 'Meta' }),
          true,
        ),
      ).toBe(true);
    });

    it('detects Control on Windows desktop', () => {
      expect(
        isPrimaryModifierKeyEvent(
          new KeyboardEvent('keydown', { key: 'Control' }),
          false,
        ),
      ).toBe(true);
    });
  });

  describe('shouldCancelModifierHintReveal', () => {
    it('cancels when a chord is pressed while modifier is held', () => {
      expect(
        shouldCancelModifierHintReveal(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
          true,
        ),
      ).toBe(true);
    });

    it('does not cancel when only the modifier key is pressed', () => {
      expect(
        shouldCancelModifierHintReveal(
          new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }),
          true,
        ),
      ).toBe(false);
    });
  });

  describe('isPrimaryModifierHeld', () => {
    it('reads metaKey on Apple desktop', () => {
      expect(
        isPrimaryModifierHeld(
          new KeyboardEvent('keydown', { key: '1', metaKey: true }),
          true,
        ),
      ).toBe(true);
    });

    it('reads ctrlKey on Windows desktop', () => {
      expect(
        isPrimaryModifierHeld(
          new KeyboardEvent('keydown', { key: '1', ctrlKey: true }),
          false,
        ),
      ).toBe(true);
    });
  });

  describe('isEditableFocused', () => {
    it('returns true when an input is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      expect(isEditableFocused()).toBe(true);

      document.body.removeChild(input);
    });

    it('returns false when body is focused', () => {
      document.body.focus();
      expect(isEditableFocused()).toBe(false);
    });
  });
});
