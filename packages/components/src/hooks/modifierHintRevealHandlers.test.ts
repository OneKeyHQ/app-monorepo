/**
 * @jest-environment jsdom
 */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MODIFIER_HINT_HOLD_MS,
  createModifierHintRevealHandlers,
} from './modifierHintRevealHandlers';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isDesktopMac: true,
  },
}));

describe('modifierHintRevealHandlers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.focus();
    platformEnv.isDesktopMac = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals hints after holding the modifier for 1000ms', () => {
    const onVisibleChange = jest.fn();
    const handlers = createModifierHintRevealHandlers({
      enabled: true,
      onVisibleChange,
    });

    expect(handlers).toBeDefined();

    handlers?.onKeyDown(
      new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }),
    );

    expect(onVisibleChange).not.toHaveBeenCalledWith(true);

    jest.advanceTimersByTime(MODIFIER_HINT_HOLD_MS);

    expect(onVisibleChange).toHaveBeenCalledWith(true);

    handlers?.onKeyUp(new KeyboardEvent('keyup', { key: 'Meta' }));
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it('cancels reveal when a chord is pressed while modifier is held', () => {
    const onVisibleChange = jest.fn();
    const handlers = createModifierHintRevealHandlers({
      enabled: true,
      onVisibleChange,
    });

    handlers?.onKeyDown(
      new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }),
    );
    handlers?.onKeyDown(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
    );
    jest.advanceTimersByTime(MODIFIER_HINT_HOLD_MS);

    expect(onVisibleChange).not.toHaveBeenCalledWith(true);
  });

  it('does not reveal when an input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const onVisibleChange = jest.fn();
    const handlers = createModifierHintRevealHandlers({
      enabled: true,
      onVisibleChange,
    });

    handlers?.onKeyDown(
      new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }),
    );
    jest.advanceTimersByTime(MODIFIER_HINT_HOLD_MS);

    expect(onVisibleChange).not.toHaveBeenCalledWith(true);

    document.body.removeChild(input);
  });

  it('reveals hints after holding Control for 1000ms on Windows/Linux', () => {
    platformEnv.isDesktopMac = false;
    const onVisibleChange = jest.fn();
    const handlers = createModifierHintRevealHandlers({
      enabled: true,
      onVisibleChange,
    });

    handlers?.onKeyDown(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }),
    );
    jest.advanceTimersByTime(MODIFIER_HINT_HOLD_MS);

    expect(onVisibleChange).toHaveBeenCalledWith(true);

    handlers?.onKeyUp(new KeyboardEvent('keyup', { key: 'Control' }));
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it('does not attach handlers when disabled', () => {
    const onVisibleChange = jest.fn();
    const handlers = createModifierHintRevealHandlers({
      enabled: false,
      onVisibleChange,
    });

    expect(handlers).toBeUndefined();
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });
});
