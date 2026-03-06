import type { RefObject } from 'react';

import type { IInputProps } from '@onekeyhq/components';

import type { TextInput } from 'react-native';

export type IAutoSizeInputProps = {
  displayValue: string;
  simpleFontSize: number;
  simpleMaxFontSize: number;
  simpleMinFontSize: number;
  availableInlineWidth: number;
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  selectionColor: string;
  handleSimpleChangeText: (text: string) => void;
  inputLoading?: boolean;
  inputPlaceholder?: string;
  inputEditable?: boolean;
  inputKeyboardType?: IInputProps['keyboardType'];
  inputReturnKeyType?: IInputProps['returnKeyType'];
  onInputFocus?: IInputProps['onFocus'];
  onInputBlur?: IInputProps['onBlur'];
  inputRef: RefObject<TextInput | null>;
  autoSizeTextValue: string;
  autoSizeInputTextColor?: string;
  autoSizePlaceholderColor?: string;
  autoSizeSelectionColor?: string;
  autoSizeTransparentColor?: string;
  onHybridRef: (ref: { focus?: () => void } | null) => void;
};
