import type { RefObject } from 'react';

import { Input, SizableText, XStack } from '@onekeyhq/components';
import type { IInputProps } from '@onekeyhq/components';

import type { TextInput } from 'react-native';

type IAutoSizeProps = {
  displayValue: string;
  simpleFontSize: number;
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  desktopAmountTextAlign: 'center' | 'right';
  desktopInlineRowOffsetPx: number;
  desktopPrefixOffset: number;
  desktopInlineSymbolOffset: number;
  inlineInputWidthPx: number;
  inlineInputMaxWidth: string;
  selectionColor: string;
  handleSimpleChangeText: (text: string) => void;
  simpleInputProps: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
    loading?: boolean;
  };
  inputRef: RefObject<TextInput | null>;
  autoSizeContainerWidth: number;
  simpleMaxFontSize: number;
  simpleMinFontSize: number;
  autoSizeTextValue: string;
  autoSizeInputTextColor?: string;
  autoSizePlaceholderColor?: string;
  autoSizeSelectionColor?: string;
  autoSizeTransparentColor?: string;
  onHybridRef: (ref: { focus?: () => void } | null) => void;
};

export function AutoSizeInput({
  displayValue,
  simpleFontSize,
  currencyLabel,
  inlineTokenSymbol,
  inlinePrefixGapPx,
  inlineSuffixGapPx,
  desktopAmountTextAlign,
  desktopInlineRowOffsetPx,
  desktopPrefixOffset,
  desktopInlineSymbolOffset,
  inlineInputWidthPx,
  inlineInputMaxWidth,
  selectionColor,
  handleSimpleChangeText,
  simpleInputProps,
  inputRef,
}: IAutoSizeProps) {
  return (
    <XStack
      width="100%"
      alignItems="center"
      justifyContent="center"
      style={
        desktopInlineRowOffsetPx
          ? { transform: [{ translateX: desktopInlineRowOffsetPx }] }
          : undefined
      }
    >
      {currencyLabel ? (
        <SizableText
          color="$text"
          fontWeight="500"
          lineHeight={Math.ceil(simpleFontSize * 1.4)}
          style={{
            fontSize: simpleFontSize,
            marginRight: inlinePrefixGapPx,
          }}
          mt={desktopPrefixOffset}
        >
          {currencyLabel}
        </SizableText>
      ) : null}
      <Input
        ref={inputRef}
        keyboardType="decimal-pad"
        fontSize={simpleFontSize}
        fontWeight="500"
        color="$text"
        unstyled
        borderWidth={0}
        bg="transparent"
        p="$0"
        px="$0"
        pl="$0"
        pr="$0"
        h={Math.ceil(simpleFontSize * 1.4)}
        size="large"
        focusVisibleStyle={undefined}
        placeholder="0"
        placeholderTextColor="$textDisabled"
        value={displayValue}
        onChangeText={handleSimpleChangeText}
        textAlign={desktopAmountTextAlign}
        containerProps={{
          width: inlineInputWidthPx,
          flexShrink: 1,
          minWidth: Math.ceil(simpleFontSize * 1.2),
          maxWidth: inlineInputMaxWidth,
          borderWidth: 0,
          bg: 'transparent',
        }}
        {...simpleInputProps}
        selectionColor={selectionColor}
        cursorColor={selectionColor}
        caretColor={selectionColor}
        {...({
          onFocus: (event: { target: HTMLInputElement }) => {
            simpleInputProps?.onFocus?.(event as never);
            if (displayValue === '0') {
              const { target } = event;
              requestAnimationFrame(() => {
                target.setSelectionRange(1, 1);
              });
            }
          },
          onClick: (e: { target: HTMLInputElement }) => {
            if (displayValue === '0') {
              e.target.setSelectionRange(1, 1);
            }
          },
          onKeyUp: (e: { target: HTMLInputElement }) => {
            if (displayValue === '0') {
              e.target.setSelectionRange(1, 1);
            }
          },
          onSelect: (e: { target: HTMLInputElement }) => {
            if (displayValue === '0' && e.target.selectionStart !== 1) {
              e.target.setSelectionRange(1, 1);
            }
          },
        } as any)}
      />
      {inlineTokenSymbol ? (
        <SizableText
          color="$text"
          fontWeight="500"
          lineHeight={Math.ceil(simpleFontSize * 1.4)}
          style={{
            fontSize: simpleFontSize,
            marginLeft: inlineSuffixGapPx,
          }}
          mt={desktopInlineSymbolOffset}
          numberOfLines={1}
        >
          {inlineTokenSymbol}
        </SizableText>
      ) : null}
    </XStack>
  );
}
