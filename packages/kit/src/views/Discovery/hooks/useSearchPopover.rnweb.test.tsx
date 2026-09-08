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

import { useEffect, useRef } from 'react';

import { act, render } from '@testing-library/react';

import type { IScrollViewRef } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  IME_KEYCODE,
  attachImeCompositionListeners,
} from '@onekeyhq/shared/src/utils/imeUtils';

import { useSearchPopover } from './useSearchPopover';

const TextInput = jest.requireActual<typeof import('react-native').TextInput>(
  'react-native-web/dist/cjs/exports/TextInput',
);

function ImeSearchInput({ onEnterPress }: { onEnterPress: () => void }) {
  const hostRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const { handleKeyDown, handleCompositionStart, handleCompositionEnd } =
    useSearchPopover({
      refreshLocalData: jest.fn(),
      scrollViewRef: scrollViewRef as React.RefObject<IScrollViewRef>,
      totalItems: 2,
      onEnterPress,
      searchValue: 'four',
      displaySearchList: true,
      displayHistoryList: false,
    });

  useEffect(() => {
    const node = hostRef.current as unknown as HTMLInputElement | null;
    if (!node) {
      return undefined;
    }
    return attachImeCompositionListeners(node, {
      onStart: handleCompositionStart,
      onEnd: handleCompositionEnd,
    });
  }, [handleCompositionStart, handleCompositionEnd]);

  return (
    <TextInput
      ref={hostRef}
      accessible
      defaultValue="four"
      blurOnSubmit={false}
      onKeyPress={handleKeyDown}
    />
  );
}

function getHostInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input');
  if (!input) {
    throw new OneKeyLocalError('RN-web TextInput host node was not rendered');
  }
  return input;
}

function dispatchEnter(
  input: HTMLInputElement,
  init: KeyboardEventInit & { keyCode?: number },
) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  input.dispatchEvent(event);
  return event;
}

describe('useSearchPopover RN-web IME Enter', () => {
  it('submits search on a normal Enter', () => {
    const onEnterPress = jest.fn();
    const { container } = render(
      <ImeSearchInput onEnterPress={onEnterPress} />,
    );
    const input = getHostInput(container);
    input.focus();

    act(() => {
      dispatchEnter(input, { keyCode: 13, isComposing: false });
    });

    expect(onEnterPress).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it('ignores composing Enter, keeps focus on confirm, then searches once', async () => {
    const onEnterPress = jest.fn();
    const { container } = render(
      <ImeSearchInput onEnterPress={onEnterPress} />,
    );
    const input = getHostInput(container);
    input.focus();

    act(() => {
      input.dispatchEvent(
        new CompositionEvent('compositionstart', {
          bubbles: true,
          data: 'four',
        }),
      );
      dispatchEnter(input, {
        keyCode: IME_KEYCODE,
        isComposing: true,
      });
    });
    expect(onEnterPress).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);

    let confirmEnter: KeyboardEvent | undefined;
    act(() => {
      input.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: 'four',
        }),
      );
      confirmEnter = dispatchEnter(input, { keyCode: 13, isComposing: false });
    });

    expect(onEnterPress).not.toHaveBeenCalled();
    expect(confirmEnter?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    act(() => {
      dispatchEnter(input, { keyCode: 13, isComposing: false });
    });

    expect(onEnterPress).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it('removes composition listeners on unmount', () => {
    const { container, unmount } = render(
      <ImeSearchInput onEnterPress={jest.fn()} />,
    );
    const input = getHostInput(container);
    const removeSpy = jest.spyOn(input, 'removeEventListener');

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'compositionstart',
      expect.any(Function),
    );
    expect(removeSpy).toHaveBeenCalledWith(
      'compositionend',
      expect.any(Function),
    );
  });
});
