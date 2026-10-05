/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
  }),
}));

jest.mock('./useSearchPopoverFeatureFlag', () => ({
  useSearchPopoverUIFeatureFlag: () => true,
}));

import { act, renderHook } from '@testing-library/react-native';

import { IME_KEYCODE } from '@onekeyhq/shared/src/utils/imeUtils';

import { useSearchPopover } from './useSearchPopover';

function createEnterEvent(overrides: Record<string, unknown> = {}): {
  key: string;
  keyCode: number;
  preventDefault: jest.Mock;
} {
  return {
    key: 'Enter',
    keyCode: 13,
    preventDefault: jest.fn(),
    ...overrides,
  };
}

function renderSearchPopoverHook(
  onEnterPress: jest.Mock,
  onEscape: jest.Mock = jest.fn(),
) {
  const scrollViewRef = { current: { scrollTo: jest.fn() } };
  return renderHook(() =>
    useSearchPopover({
      refreshLocalData: jest.fn(),
      scrollViewRef: scrollViewRef as never,
      totalItems: 2,
      onEnterPress,
      onEscape,
      searchValue: 'four',
      displaySearchList: true,
      displayHistoryList: false,
    }),
  );
}

describe('useSearchPopover IME Enter handling', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('submits search on a normal Enter', () => {
    const onEnterPress = jest.fn();
    const { result } = renderSearchPopoverHook(onEnterPress);
    const event = createEnterEvent();

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onEnterPress).toHaveBeenCalledTimes(1);
  });

  it('does not submit while isComposing or IME keyCode 229', () => {
    const onEnterPress = jest.fn();
    const { result } = renderSearchPopoverHook(onEnterPress);
    const composingEvent = createEnterEvent({ isComposing: true });
    const imeKeyCodeEvent = createEnterEvent({ keyCode: IME_KEYCODE });

    act(() => {
      result.current.handleKeyDown(composingEvent);
      result.current.handleKeyDown(imeKeyCodeEvent);
    });

    expect(composingEvent.preventDefault).not.toHaveBeenCalled();
    expect(imeKeyCodeEvent.preventDefault).not.toHaveBeenCalled();
    expect(onEnterPress).not.toHaveBeenCalled();
  });

  it('does not submit the Enter that confirms IME composition', () => {
    jest.useFakeTimers();
    const onEnterPress = jest.fn();
    const { result } = renderSearchPopoverHook(onEnterPress);
    const confirmEvent = createEnterEvent();

    act(() => {
      result.current.handleCompositionStart();
    });
    act(() => {
      result.current.handleCompositionEnd();
      result.current.handleKeyDown(confirmEvent);
    });

    expect(confirmEvent.preventDefault).not.toHaveBeenCalled();
    expect(onEnterPress).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const nextEnter = createEnterEvent();
    act(() => {
      result.current.handleKeyDown(nextEnter);
    });

    expect(nextEnter.preventDefault).toHaveBeenCalled();
    expect(onEnterPress).toHaveBeenCalledTimes(1);
  });

  it('does not run search shortcuts while composition is locked', () => {
    const onEnterPress = jest.fn();
    const onEscape = jest.fn();
    const { result } = renderSearchPopoverHook(onEnterPress, onEscape);
    const arrowEvent = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    };
    const escapeEvent = {
      key: 'Escape',
      preventDefault: jest.fn(),
    };

    act(() => {
      result.current.handleCompositionStart();
      result.current.handleKeyDown(arrowEvent);
      result.current.handleKeyDown(escapeEvent);
    });

    expect(result.current.selectedIndex).toBe(-1);
    expect(arrowEvent.preventDefault).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
    expect(onEnterPress).not.toHaveBeenCalled();
  });
});
