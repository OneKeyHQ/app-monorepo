import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { TextInput as RNTextInput, StyleSheet } from 'react-native';

import {
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useTheme,
} from '@onekeyhq/components';
import { AddressBadge } from '@onekeyhq/kit/src/components/AddressBadge';
import { SelectorPlugin } from '@onekeyhq/kit/src/components/AddressInput/plugins/selector';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { LayoutChangeEvent } from 'react-native';
import { showUploadCSVDialog } from '../UploadCSVDialog';

export type ILineError = {
  lineNumber: number;
  message: string;
};

export type ILineNumberedTextAreaProps = {
  value?: string;
  onChange?: (text: string) => void;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  errors?: ILineError[];
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  showLineNumbers?: boolean;
  showPaste?: boolean;
  showUpload?: boolean;
  showAccountSelector?: boolean;
  singleLine?: boolean;
  showAddressBadges?: boolean;
  addressBadges?: IAddressBadge[];
  accountSelector?: {
    num?: number;
    clearNotMatch?: boolean;
    onBeforeAccountSelectorOpen?: () => void;
  };
  onActiveAccountChange?: (
    activeAccount: IAccountSelectorActiveAccountInfo,
  ) => void;
  networkId?: string;
  accountId?: string;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
};

const FONT_SIZE = 16;
const LINE_HEIGHT = 24;
const PADDING_VERTICAL = 12;
const PADDING_HORIZONTAL = 12;
const LINE_NUMBER_WIDTH = 40;
// Allow 2 lines of text in singleLine mode for wrapped long addresses
const SINGLE_LINE_HEIGHT = LINE_HEIGHT * 2 + PADDING_VERTICAL * 2;

function LineNumberedTextArea({
  value = '',
  onChange,
  onChangeText,
  placeholder,
  errors = [],
  height: heightProp,
  minHeight: minHeightProp = 120,
  maxHeight: maxHeightProp = 300,
  disabled,
  showLineNumbers: showLineNumbersProp = true,
  showPaste,
  showUpload,
  showAccountSelector,
  singleLine,
  showAddressBadges,
  addressBadges,
  accountSelector,
  onActiveAccountChange,
  networkId,
  accountId,
  onInputTypeChange,
}: ILineNumberedTextAreaProps) {
  const intl = useIntl();
  const inputRef = useRef<RNTextInput>(null);
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});
  const { getClipboard } = useClipboard();
  const theme = useTheme();
  const textColor = theme.text?.val;
  const [inputText, setInputText] = useState<string>(value);
  const inputTextRef = useRef<string>('');

  // Calculate height based on singleLine mode
  const height = singleLine && !heightProp ? SINGLE_LINE_HEIGHT : heightProp;
  const minHeight =
    singleLine && !heightProp ? SINGLE_LINE_HEIGHT : minHeightProp;
  const maxHeight =
    singleLine && !heightProp ? SINGLE_LINE_HEIGHT : maxHeightProp;

  // Support both onChange and onChangeText for Form compatibility
  const handleChangeText = useCallback(
    (text: string) => {
      let processedText = text;
      if (singleLine) {
        // Only keep the first line when singleLine is enabled
        const firstLine = text.split('\n')[0];
        processedText = firstLine ?? '';
      }
      inputTextRef.current = processedText;
      setInputText(processedText);
      onChangeText?.(processedText);
      onChange?.(processedText);
    },
    [onChange, onChangeText, singleLine],
  );

  // Built-in paste handler
  const handlePaste = useCallback(async () => {
    const clipboardText = await getClipboard();
    if (clipboardText) {
      let newValue: string;
      if (singleLine) {
        // In single line mode, replace with first line of clipboard
        newValue = clipboardText.split('\n')[0] ?? '';
      } else {
        // In multi-line mode, append clipboard content
        newValue = value ? `${value}\n${clipboardText}` : clipboardText;
      }
      onInputTypeChange?.(EInputAddressChangeType.Paste);
      handleChangeText(newValue);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_address_pasted_text,
        }),
      });
    }
  }, [
    getClipboard,
    value,
    handleChangeText,
    intl,
    singleLine,
    onInputTypeChange,
  ]);

  // Only split into lines if there's content
  const lines = useMemo(() => {
    if (!value) return [];
    return value.split('\n');
  }, [value]);

  const errorLineNumbers = useMemo(() => {
    const errorSet = new Set<number>();
    errors.forEach((error) => {
      errorSet.add(error.lineNumber);
    });
    return errorSet;
  }, [errors]);

  const handleContainerPress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleLineLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { height: layoutHeight } = event.nativeEvent.layout;
      setLineHeights((prev) => {
        if (prev[index] === layoutHeight) return prev;
        return { ...prev, [index]: layoutHeight };
      });
    },
    [],
  );

  const hasActions = showPaste || showUpload || showAccountSelector;
  const hasContent = lines.length > 0;
  // Show line numbers based on prop
  const showLineNumbers = showLineNumbersProp;

  const handleUpload = useCallback(() => {
    showUploadCSVDialog({
      onUpload: () => {
        console.log('Upload clicked');
      },
      onDownloadTemplate: () => {
        console.log('Download template clicked');
      },
    });
  }, []);

  const handleSelectedAccountChange = useCallback(
    ({
      text,
      inputType,
    }: {
      text: string;
      inputType: EInputAddressChangeType;
    }) => {
      onInputTypeChange?.(inputType);

      handleChangeText(text);
    },
    [handleChangeText, onInputTypeChange],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        textInput: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: PADDING_VERTICAL,
          paddingBottom: PADDING_VERTICAL,
          paddingLeft: PADDING_HORIZONTAL,
          paddingRight: PADDING_HORIZONTAL,
          fontSize: FONT_SIZE,
          lineHeight: LINE_HEIGHT,
          // Use transparent color but ensure caret is visible
          color: platformEnv.isNative ? 'rgba(0,0,0,0.01)' : 'transparent',
          textAlignVertical: 'top',
          // Web: caretColor makes cursor visible even with transparent text
          ...(platformEnv.isNative ? {} : { caretColor: textColor }),
        } as any,
      }),
    [textColor],
  );

  return (
    <YStack>
      <Stack
        borderWidth="$px"
        borderColor="$borderStrong"
        borderRadius="$3"
        bg="$bgApp"
        overflow="hidden"
        borderCurve="continuous"
        onPress={handleContainerPress}
        cursor="text"
      >
        <ScrollView
          height={height}
          maxHeight={height ?? maxHeight}
          minHeight={height ?? minHeight}
          showsVerticalScrollIndicator={false}
        >
          <XStack minHeight={(height ?? minHeight) - 2}>
            {/* Line numbers column - show when focused or has content */}
            {showLineNumbers ? (
              <YStack
                width={LINE_NUMBER_WIDTH}
                flexShrink={0}
                pt={PADDING_VERTICAL}
                pb={PADDING_VERTICAL}
              >
                {(hasContent ? lines : ['']).map((_, index) => {
                  const lineNumber = index + 1;
                  const lineHeight = lineHeights[index] || LINE_HEIGHT;
                  return (
                    <Stack
                      key={index}
                      height={lineHeight}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <SizableText
                        fontSize={FONT_SIZE}
                        lineHeight={LINE_HEIGHT}
                        color="textSubdued"
                      >
                        {lineNumber}
                      </SizableText>
                    </Stack>
                  );
                })}
              </YStack>
            ) : null}

            {/* Content area */}
            <Stack flex={1} position="relative">
              {/* Display layer - styled text with word wrap */}
              <YStack
                pt={PADDING_VERTICAL}
                pb={PADDING_VERTICAL}
                pl={PADDING_HORIZONTAL}
                pr={PADDING_HORIZONTAL}
                pointerEvents="none"
              >
                {hasContent ? (
                  lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const hasError = errorLineNumbers.has(lineNumber);

                    return (
                      <Stack
                        key={index}
                        onLayout={(e: LayoutChangeEvent) =>
                          handleLineLayout(index, e)
                        }
                      >
                        <SizableText
                          fontSize={FONT_SIZE}
                          lineHeight={LINE_HEIGHT}
                          color={hasError ? '$textCritical' : '$text'}
                        >
                          {line || ' '}
                        </SizableText>
                      </Stack>
                    );
                  })
                ) : (
                  <SizableText
                    fontSize={FONT_SIZE}
                    lineHeight={LINE_HEIGHT}
                    color="$textPlaceholder"
                  >
                    {placeholder}
                  </SizableText>
                )}
              </YStack>

              {/* Input layer - transparent textarea */}
              <RNTextInput
                ref={inputRef}
                value={value}
                onChange={() => {
                  onInputTypeChange?.(EInputAddressChangeType.Manual);
                }}
                onChangeText={handleChangeText}
                editable={!disabled}
                multiline
                style={styles.textInput}
                selectionColor={textColor}
                cursorColor={textColor}
                spellCheck={false}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </Stack>
          </XStack>
        </ScrollView>

        {/* Action buttons */}
        {hasActions || showAddressBadges ? (
          <XStack
            justifyContent="space-between"
            flexWrap="nowrap"
            alignItems="center"
            py="$3"
            px="$3"
          >
            <XStack gap="$2" flex={1}>
              {addressBadges?.map((badge) => (
                <AddressBadge
                  key={badge.label}
                  title={badge.label}
                  badgeType={badge.type}
                  content={badge.tip}
                  icon={badge.icon}
                />
              ))}
            </XStack>
            {hasActions ? (
              <XStack justifyContent="flex-end" gap="$6">
                {showPaste ? (
                  <IconButton
                    variant="tertiary"
                    icon="ClipboardOutline"
                    onPress={handlePaste}
                    disabled={disabled}
                    title={intl.formatMessage({
                      id: ETranslations.send_to_paste_tooltip,
                    })}
                  />
                ) : null}
                {showUpload ? (
                  <IconButton
                    variant="tertiary"
                    icon="UploadOutline"
                    onPress={handleUpload}
                    disabled={disabled}
                    title={intl.formatMessage({
                      id: ETranslations.global_upload,
                    })}
                  />
                ) : null}
                {showAccountSelector ? (
                  <SelectorPlugin
                    disabled={disabled}
                    onChange={handleSelectedAccountChange}
                    onActiveAccountChange={onActiveAccountChange}
                    networkId={networkId}
                    accountId={accountId}
                    num={accountSelector?.num}
                    currentAddress={inputText}
                    clearNotMatch={accountSelector?.clearNotMatch}
                    onBeforeAccountSelectorOpen={
                      accountSelector?.onBeforeAccountSelectorOpen
                    }
                  />
                ) : null}
              </XStack>
            ) : null}
          </XStack>
        ) : null}
      </Stack>
    </YStack>
  );
}

export default LineNumberedTextArea;
