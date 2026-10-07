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

import type {
  ComponentType,
  CompositionEvent as ReactCompositionEvent,
} from 'react';
import { useRef } from 'react';

import { act, render } from '@testing-library/react';

import type { IScrollViewRef } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { IME_KEYCODE } from '@onekeyhq/shared/src/utils/imeUtils';

import { useSearchPopover } from './useSearchPopover';

import type { TextInputProps } from 'react-native';

type IWebTextInputProps = TextInputProps & {
  onCompositionStart?: (event: ReactCompositionEvent<HTMLInputElement>) => void;
  onCompositionEnd?: (event: ReactCompositionEvent<HTMLInputElement>) => void;
};

// The repository's RN-web ESM patch forwards these React composition props.
const TextInput = jest.requireActual<{
  default: ComponentType<IWebTextInputProps>;
}>('react-native-web/dist/exports/TextInput').default;

function ImeSearchInput({ onEnterPress }: { onEnterPress: () => void }) {
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

  return (
    <TextInput
      accessible
      defaultValue="four"
      blurOnSubmit={false}
      onKeyPress={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
}

function LateBoundCompositionInput({
  onCompositionStart,
  onCompositionEnd,
}: {
  onCompositionStart?: (event: ReactCompositionEvent<HTMLInputElement>) => void;
  onCompositionEnd?: (event: ReactCompositionEvent<HTMLInputElement>) => void;
}) {
  return (
    <TextInput
      accessible
      defaultValue="four"
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
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

  it('forwards React composition events with nativeEvent once, including late-added callbacks', () => {
    const onCompositionStart = jest.fn();
    const onCompositionEnd = jest.fn();
    const { container, rerender } = render(<LateBoundCompositionInput />);
    const input = getHostInput(container);

    act(() => {
      input.dispatchEvent(
        new CompositionEvent('compositionstart', {
          bubbles: true,
          data: 'four',
        }),
      );
      input.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: 'four',
        }),
      );
    });
    expect(onCompositionStart).not.toHaveBeenCalled();
    expect(onCompositionEnd).not.toHaveBeenCalled();

    rerender(
      <LateBoundCompositionInput
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />,
    );

    act(() => {
      input.dispatchEvent(
        new CompositionEvent('compositionstart', {
          bubbles: true,
          data: 'four',
        }),
      );
      input.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: 'four',
        }),
      );
    });

    expect(onCompositionStart).toHaveBeenCalledTimes(1);
    expect(onCompositionEnd).toHaveBeenCalledTimes(1);
    expect(onCompositionStart.mock.calls[0][0].nativeEvent).toBeInstanceOf(
      CompositionEvent,
    );
    expect(onCompositionEnd.mock.calls[0][0].nativeEvent).toBeInstanceOf(
      CompositionEvent,
    );
  });
});
