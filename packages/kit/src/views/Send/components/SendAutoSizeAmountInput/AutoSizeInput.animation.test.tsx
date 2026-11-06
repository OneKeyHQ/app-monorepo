/** @jest-environment jsdom */

import { forwardRef, useRef, useState } from 'react';
import type { InputHTMLAttributes, PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import type { IAutoSizeInputProps } from './AutoSizeInput.types';

let reducedMotion = false;
const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;
const MockInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    onChangeText: (value: string) => void;
    editable?: boolean;
  }
>(({ value, onChangeText, onFocus, onBlur, onSelect, editable }, ref) => (
  <input
    ref={ref}
    value={value}
    onChange={(event) => onChangeText(event.target.value)}
    onFocus={onFocus}
    onBlur={onBlur}
    onSelect={onSelect}
    readOnly={editable === false}
  />
));
MockInput.displayName = 'MockInput';

jest.mock('@onekeyhq/components', () => ({
  Input: MockInput,
  SizableText: Box,
  Stack: Box,
  XStack: Box,
  useTheme: () => ({
    text: { val: '#000000' },
    textDisabled: { val: '#888888' },
  }),
  webFontFamily: 'sans-serif',
}));
jest.mock('react-native', () => ({ Text: Box, View: Box }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { Text: Box },
  Easing: { bezier: () => (value: number) => value },
  Keyframe: class {
    duration() {
      return this;
    }
  },
  useReducedMotion: () => reducedMotion,
  useSharedValue: (value: number) => useRef({ value }).current,
  useAnimatedStyle: (callback: () => unknown) => callback(),
  withTiming: (value: number) => value,
  cancelAnimation: () => undefined,
}));

const { AutoSizeInput } =
  jest.requireActual<typeof import('./AutoSizeInput')>('./AutoSizeInput');
const props: IAutoSizeInputProps = {
  value: '12.30',
  fontSize: 48,
  maxFontSize: 64,
  minFontSize: 14,
  availableInlineWidth: 350,
  fontFamily: 'sans-serif',
  selectionColor: '#000000',
  inlinePrefixGapPx: 0,
  inlineSuffixGapPx: 8,
  currencyLabel: '$',
  onChangeText: jest.fn(),
  inputAnimation: 'typing',
};

beforeEach(() => {
  reducedMotion = false;
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => jest.restoreAllMocks());

it('keeps the editable input and its exact value while inserting and deleting', () => {
  function ControlledInput() {
    const [value, setValue] = useState(props.value);
    return <AutoSizeInput {...props} value={value} onChangeText={setValue} />;
  }
  const { getByRole } = render(<ControlledInput />);
  const input = getByRole('textbox') as HTMLInputElement;
  input.focus();
  for (const value of [
    '12.300',
    '12.30',
    '12.',
    '12',
    '12345678901234567890.001',
  ]) {
    fireEvent.change(input, { target: { value } });
    expect(getByRole('textbox')).toBe(input);
    expect(input.value).toBe(value);
    expect(document.activeElement).toBe(input);
  }
});

it('preserves selection and updates immediately when switching to slider mode', () => {
  const { getByRole, rerender } = render(<AutoSizeInput {...props} />);
  const input = getByRole('textbox') as HTMLInputElement;
  input.focus();
  input.setSelectionRange(1, 2);
  fireEvent.select(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2]);

  rerender(
    <AutoSizeInput {...props} inputAnimation="instant" value="987.65" />,
  );
  expect(getByRole('textbox')).toBe(input);
  expect(input.value).toBe('987.65');
  expect(document.activeElement).toBe(input);
});

it('disables the width transition when reduced motion is enabled', () => {
  reducedMotion = true;
  const { container } = render(<AutoSizeInput {...props} />);
  expect(container.querySelector('[style*="transition"]')).toBeNull();
});
