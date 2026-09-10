/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isRuntimeBrowser() {
      return (
        (globalThis as Record<string, unknown>).__isRuntimeBrowser === true
      );
    },
  },
}));

import { buildCategoryRowActivationProps } from './categoryRowActivation';

function setBrowser(value: boolean) {
  (globalThis as Record<string, unknown>).__isRuntimeBrowser = value;
}

describe('buildCategoryRowActivationProps', () => {
  describe('on the web', () => {
    beforeEach(() => setBrowser(true));

    it('puts an enabled row in the tab order as a button', () => {
      const props = buildCategoryRowActivationProps({
        onActivate: jest.fn(),
        outlineOffset: -2,
      });

      expect(props.role).toBe('button');
      expect(props.tabIndex).toBe(0);
      expect(props.focusVisibleStyle).toMatchObject({ outlineOffset: -2 });
    });

    it.each([
      ['Enter', 'Enter'],
      ['Space', ' '],
    ])('activates on %s', (_label, key) => {
      const onActivate = jest.fn();
      const preventDefault = jest.fn();
      const props = buildCategoryRowActivationProps({
        onActivate,
        outlineOffset: 1,
      });

      (props.onKeyDown as (e: unknown) => void)({ key, preventDefault });

      expect(onActivate).toHaveBeenCalledTimes(1);
      // Space would scroll the modal out from under the row otherwise.
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it('leaves every other key to the page', () => {
      const onActivate = jest.fn();
      const preventDefault = jest.fn();
      const props = buildCategoryRowActivationProps({
        onActivate,
        outlineOffset: 1,
      });

      (props.onKeyDown as (e: unknown) => void)({ key: 'Tab', preventDefault });

      expect(onActivate).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    // A disabled row that keeps tabIndex is a button a keyboard user can reach
    // and then cannot use.
    it('takes a disabled row out of the tab order and says why', () => {
      const props = buildCategoryRowActivationProps({
        disabled: true,
        onActivate: jest.fn(),
        outlineOffset: -2,
      });

      expect(props.tabIndex).toBeUndefined();
      expect(props.onKeyDown).toBeUndefined();
      expect(props.onPress).toBeUndefined();
      expect(props['aria-disabled']).toBe(true);
      expect(props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('on native', () => {
    beforeEach(() => setBrowser(false));

    // role, tabIndex and onKeyDown are DOM-only; React warns about them on a
    // native View.
    it('ships no DOM-only props', () => {
      const props = buildCategoryRowActivationProps({
        onActivate: jest.fn(),
        outlineOffset: -2,
      });

      expect(props.role).toBeUndefined();
      expect(props.tabIndex).toBeUndefined();
      expect(props.onKeyDown).toBeUndefined();
      expect(props.accessibilityRole).toBe('button');
      expect(typeof props.onPress).toBe('function');
    });

    it('ships no DOM-only props on a disabled row either', () => {
      const props = buildCategoryRowActivationProps({
        disabled: true,
        onActivate: jest.fn(),
        outlineOffset: -2,
      });

      expect(props.role).toBeUndefined();
      expect(props['aria-disabled']).toBeUndefined();
      expect(props.accessibilityState).toEqual({ disabled: true });
    });
  });

  it('reports selection to the screen reader', () => {
    setBrowser(true);

    expect(
      buildCategoryRowActivationProps({
        onActivate: jest.fn(),
        selected: true,
        outlineOffset: -2,
      }).accessibilityState,
    ).toEqual({ selected: true });
    expect(
      buildCategoryRowActivationProps({
        onActivate: jest.fn(),
        selected: false,
        outlineOffset: -2,
      }).accessibilityState,
    ).toEqual({ selected: false });
  });

  // The collapsed trigger is one control with no selected state of its own.
  it('says nothing about selection when the caller has none', () => {
    setBrowser(true);

    expect(
      buildCategoryRowActivationProps({
        onActivate: jest.fn(),
        outlineOffset: 1,
      }).accessibilityState,
    ).toEqual({});
  });
});
