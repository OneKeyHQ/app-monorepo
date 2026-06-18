import type { IInputProps } from '@onekeyhq/components';

export type IAutoSizeInputRef = {
  focus: () => void;
  blur: () => void;
};

export type IAutoSizeInputProps = {
  // Controlled input text used by both web and native implementations.
  // iOS native can pass a hidden pulse marker to force prop write-back.
  value: string;
  fontSize: number;
  maxFontSize: number;
  minFontSize: number;
  availableInlineWidth: number;
  inlineTextAlignMode?: 'auto' | 'center';
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  // Shared selection color for web/native text cursor and selection.
  selectionColor: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: IInputProps['keyboardType'];
  returnKeyType?: IInputProps['returnKeyType'];
  onFocus?: IInputProps['onFocus'];
  onBlur?: IInputProps['onBlur'];
  // Shared text color for amount/prefix/suffix in native auto-size input.
  textColor?: string;
  placeholderColor?: string;
  // Background color is currently used by native auto-size input.
  backgroundColor?: string;
};
