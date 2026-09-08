/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

const mockInputProps: {
  current: {
    onSubmitEditing?: (event: { nativeEvent: { text: string } }) => void;
    onCompositionStart?: () => void;
    onCompositionEnd?: (event: { target: { value: string } }) => void;
    blurOnSubmit?: boolean;
  };
} = {
  current: {},
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../forms/Input', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Input: React.forwardRef(
      (
        props: (typeof mockInputProps)['current'],
        _ref: unknown,
      ): React.ReactElement | null => {
        mockInputProps.current = props;
        return null;
      },
    ),
  };
});

import { SearchBar } from '.';

import { act, render } from '@testing-library/react';

describe('SearchBar IME submit lock', () => {
  beforeEach(() => {
    mockInputProps.current = {};
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('suppresses confirming submit while locked, then accepts native submit', () => {
    jest.useFakeTimers();
    const onSubmitEditing = jest.fn();
    render(<SearchBar onSubmitEditing={onSubmitEditing} />);

    const {
      onCompositionStart,
      onCompositionEnd,
      onSubmitEditing: submit,
      blurOnSubmit,
    } = mockInputProps.current;
    expect(blurOnSubmit).toBe(false);
    const nativeSubmitEvent = { nativeEvent: { text: 'four' } };

    act(() => {
      onCompositionStart?.();
      onCompositionEnd?.({ target: { value: 'four' } });
      submit?.(nativeSubmitEvent);
    });
    expect(onSubmitEditing).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    act(() => {
      submit?.(nativeSubmitEvent);
    });
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
    expect(onSubmitEditing).toHaveBeenCalledWith(nativeSubmitEvent);
  });
});
