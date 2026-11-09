/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import assert from 'node:assert/strict';

import { act, render } from '@testing-library/react';

import PassCodeInput from './PassCodeInput';

interface ICaptured {
  field: {
    value: string;
    editable?: boolean;
    onChangeText: (text: string) => void;
  };
  cellSetValue: (text: string) => void;
}
interface ICodeFieldMock {
  __captured: ICaptured;
}

jest.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => children ?? null,
}));

// CodeField renders a hidden TextInput plus one cell per digit. The suite only
// needs the props PassCodeInput hands it: the value it displays, the text
// handler, and the cell-tap setter from useClearByFocusCell.
jest.mock('react-native-confirmation-code-field', () => {
  const capture = {} as ICaptured;
  return {
    __captured: capture,
    CodeField: (props: ICaptured['field']) => {
      capture.field = props;
      return null;
    },
    useClearByFocusCell: ({
      setValue,
    }: {
      value: string;
      setValue: (text: string) => void;
    }) => {
      capture.cellSetValue = setValue;
      return [{}, () => () => undefined];
    },
  };
});

jest.mock('@onekeyhq/components', () => ({
  YStack: () => null,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: false, isNativeIOS: false },
}));

const { __captured: captured } = jest.requireMock<ICodeFieldMock>(
  'react-native-confirmation-code-field',
);

describe('PassCodeInput', () => {
  it('keeps showing the caller value when the caller rejects an edit', () => {
    const onPinCodeChange = jest.fn();
    render(
      <PassCodeInput
        value="12"
        cellCount={4}
        onPinCodeChange={onPinCodeChange}
      />,
    );

    // The caller ignores this edit (e.g. a cooldown) and keeps value="12".
    act(() => captured.field.onChangeText('123'));

    expect(onPinCodeChange).toHaveBeenCalledWith('123');
    assert.equal(captured.field.value, '12');
  });

  it('shows the new value once the caller accepts it', () => {
    const { rerender } = render(<PassCodeInput value="12" cellCount={4} />);

    rerender(<PassCodeInput value="123" cellCount={4} />);
    assert.equal(captured.field.value, '123');

    // Parents reset the field (error retry, navigating back) through value.
    rerender(<PassCodeInput value="" cellCount={4} />);
    assert.equal(captured.field.value, '');
  });

  it('strips non-digits and completes at the configured cell count', () => {
    const onPinCodeChange = jest.fn();
    const onComplete = jest.fn();
    render(
      <PassCodeInput
        cellCount={4}
        onPinCodeChange={onPinCodeChange}
        onComplete={onComplete}
      />,
    );

    act(() => captured.field.onChangeText('12a3'));
    expect(onPinCodeChange).toHaveBeenLastCalledWith('123');
    expect(onComplete).not.toHaveBeenCalled();
    assert.equal(captured.field.value, '123');

    act(() => captured.field.onChangeText('1234'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    assert.equal(captured.field.value, '1234');
  });

  it('reports a cell tap that truncates the code', () => {
    const onPinCodeChange = jest.fn();
    render(
      <PassCodeInput
        value="1234"
        cellCount={4}
        onPinCodeChange={onPinCodeChange}
      />,
    );

    act(() => captured.cellSetValue('12'));

    expect(onPinCodeChange).toHaveBeenCalledWith('12');
  });

  it('ignores a cell tap that leaves the code unchanged', () => {
    const onPinCodeChange = jest.fn();
    render(
      <PassCodeInput
        value="1234"
        cellCount={4}
        onPinCodeChange={onPinCodeChange}
      />,
    );

    act(() => captured.cellSetValue('1234'));

    expect(onPinCodeChange).not.toHaveBeenCalled();
  });

  it('ignores cell taps while the field is not editable', () => {
    const onPinCodeChange = jest.fn();
    render(
      <PassCodeInput
        value="1234"
        cellCount={4}
        editable={false}
        onPinCodeChange={onPinCodeChange}
      />,
    );

    act(() => captured.cellSetValue('12'));

    expect(onPinCodeChange).not.toHaveBeenCalled();
    assert.equal(captured.field.value, '1234');
  });
});
