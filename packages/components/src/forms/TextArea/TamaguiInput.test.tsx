/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { useInputProps } from './TamaguiInput';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => {
  const Frame = Object.assign(() => null, {
    styleable: (render: unknown) => render,
  });
  return {
    styled: () => Frame,
    useComposedRefs: () => undefined,
    useFocusable: ({ props }: { props: { onChangeText?: unknown } }) => ({
      onChangeText: props.onChangeText,
      ref: undefined,
    }),
    useTheme: () => ({}),
  };
});

jest.mock('../Input/TextInput', () => ({
  __esModule: true,
  default: () => null,
}));

describe('useInputProps', () => {
  it('keeps editable={false} when disabled is explicitly false', () => {
    // Group passes `disabled: false` to its items, e.g. the Select trigger.
    const { result } = renderHook(() =>
      useInputProps({ disabled: false, editable: false }, null),
    );

    expect(result.current.readOnly).toBeUndefined();
    expect(result.current.editable).toBe(false);
  });

  it('marks a disabled input as read-only', () => {
    const { result } = renderHook(() =>
      useInputProps({ disabled: true }, null),
    );

    expect(result.current.readOnly).toBe(true);
  });

  it('lets an explicit readOnly prop override the disabled mapping', () => {
    const { result } = renderHook(() =>
      useInputProps({ disabled: true, readOnly: false }, null),
    );

    expect(result.current.readOnly).toBe(false);
  });
});
