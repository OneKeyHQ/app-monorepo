import type { RefObject } from 'react';

import type { IInputProps } from '@onekeyhq/components';

import type { TextInput } from 'react-native';

export type IAutoSizeInputProps = {
  /** Current input value (canonical form value) */
  value: string;
  /** Computed font size based on text length */
  fontSize: number;
  /** Maximum font size for auto-sizing */
  maxFontSize: number;
  /** Minimum font size for auto-sizing */
  minFontSize: number;
  /** Available container width for inline layout (px) */
  availableWidth: number;
  /** Currency prefix label (e.g. "$", "EUR") */
  prefix?: string;
  /** Token symbol displayed as suffix (e.g. "ETH") */
  suffix?: string;
  /** Gap between prefix and input (px) */
  prefixGap: number;
  /** Gap between input and suffix (px) */
  suffixGap: number;
  /** Selection / cursor highlight color (web) */
  selectionColor: string;
  /** Called when user changes the input text */
  onChangeText: (text: string) => void;
  /** Placeholder text shown when input is empty */
  placeholder?: string;
  /** Whether the input is editable */
  editable?: boolean;
  /** Keyboard type */
  keyboardType?: IInputProps['keyboardType'];
  /** Return key type */
  returnKeyType?: IInputProps['returnKeyType'];
  /** Focus event handler */
  onFocus?: IInputProps['onFocus'];
  /** Blur event handler */
  onBlur?: IInputProps['onBlur'];
  /** Ref for the web TextInput element (web only) */
  inputRef: RefObject<TextInput | null>;
  /** Input text color (Android-normalized on native) */
  textColor?: string;
  /** Placeholder text color (Android-normalized on native) */
  placeholderColor?: string;
  /** Selection highlight color (Android-normalized on native) */
  nativeSelectionColor?: string;
  /** Input background color (Android-normalized on native) */
  backgroundColor?: string;
  /** Callback for native HybridView ref (native only) */
  onHybridRef: (ref: { focus?: () => void } | null) => void;
  /** When true, suppress soft keyboard on native (used with custom NumericKeyboard) */
  disableSoftKeyboard?: boolean;
};
