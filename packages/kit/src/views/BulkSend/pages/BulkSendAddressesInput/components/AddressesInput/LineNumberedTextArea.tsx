import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import {
  Keyboard,
  type LayoutChangeEvent,
  type ScrollView as RNScrollView,
  TextInput as RNTextInput,
  type View as RNView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useScrollView,
  useSelectionColor,
  useTheme,
} from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import { AddressBadge } from '@onekeyhq/kit/src/components/AddressBadge';
import { SelectorPlugin } from '@onekeyhq/kit/src/components/AddressInput/plugins/selector';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

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
    accountSelectorOnly?: boolean;
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
const PADDING_HORIZONTAL_WITH_LINE_NUMBERS = 4;
const LINE_NUMBER_WIDTH = 40;
// On iOS, RNTextInput (UITextView) has extra internal text inset compared to
// SizableText (UILabel). This offset compensates so line numbers align with the text.
// On Android, EditText with includeFontPadding=false has no such extra inset.
const NATIVE_LINE_NUMBER_TOP_OFFSET = platformEnv.isNativeIOS ? 3 : 0;
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
  const safeAreaInsets = useSafeAreaInsets();
  const inputRef = useRef<RNTextInput>(null);
  const scrollViewRef = useRef<RNScrollView>(null);
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});
  const { getClipboard } = useClipboard();
  const theme = useTheme();
  const textColor = theme.text?.val;
  const selectionColor = useSelectionColor();
  const placeholderColor = theme.textPlaceholder?.val;
  const [inputText, setInputText] = useState<string>(value);
  const [contentHeight, setContentHeight] = useState(0);

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

  // #1 iOS: scroll outer page ScrollView to keep this component visible above keyboard
  const { scrollViewRef: pageScrollViewRef, pageOffsetRef } = useScrollView();
  const containerRef = useRef<RNView>(null);
  const isFocusedRef = useRef(false);
  const lastKeyboardScreenYRef = useRef<number | null>(null);

  const scrollOuterToShowComponent = useCallback(
    (keyboardScreenY: number) => {
      if (
        !containerRef.current ||
        !pageScrollViewRef.current ||
        typeof pageScrollViewRef.current.scrollTo !== 'function'
      )
        return;

      containerRef.current.measureInWindow((_x, y, _w, h) => {
        const componentBottom = y + h;
        // 80px buffer so we don't scroll when only barely near the keyboard
        if (componentBottom <= keyboardScreenY - 80) return;

        // 52px = navigation header height
        const headerBottom = safeAreaInsets.top + 52;
        const scrollBy = y - headerBottom;

        if (scrollBy > 0) {
          const currentY = pageOffsetRef.current.y;
          pageScrollViewRef.current?.scrollTo({
            y: currentY + scrollBy,
            animated: true,
          });
        }
      });
    },
    [pageScrollViewRef, pageOffsetRef, safeAreaInsets.top],
  );

  useEffect(() => {
    if (!platformEnv.isNativeIOS || singleLine) return () => {};

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      lastKeyboardScreenYRef.current = e.endCoordinates.screenY;
      if (isFocusedRef.current) {
        scrollOuterToShowComponent(e.endCoordinates.screenY);
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      lastKeyboardScreenYRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollOuterToShowComponent, singleLine]);

  const handleContainerPress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;

    // #2 Scroll internal ScrollView to show content bottom
    if (scrollViewRef.current && contentHeight > (height ?? maxHeight)) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }

    // If keyboard is already shown (switching between inputs), trigger outer scroll
    if (
      platformEnv.isNativeIOS &&
      lastKeyboardScreenYRef.current !== null &&
      lastKeyboardScreenYRef.current !== undefined
    ) {
      const keyboardY = lastKeyboardScreenYRef.current;
      setTimeout(() => {
        if (
          isFocusedRef.current &&
          keyboardY !== null &&
          keyboardY !== undefined
        ) {
          scrollOuterToShowComponent(keyboardY);
        }
      }, 100);
    }
  }, [scrollOuterToShowComponent, contentHeight, height, maxHeight]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
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

  // Auto-scroll to bottom when content height changes
  useEffect(() => {
    if (contentHeight > 0 && scrollViewRef.current) {
      const scrollHeight = height ?? maxHeight;
      if (contentHeight > scrollHeight) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }
  }, [contentHeight, height, maxHeight]);

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h);
  }, []);

  const handleUpload = useCallback(() => {
    showUploadCSVDialog({
      onUploaded: (uploadedLines) => {
        const content = uploadedLines.join('\n');
        onInputTypeChange?.(EInputAddressChangeType.Upload);
        handleChangeText(content);
      },
    });
  }, [handleChangeText, onInputTypeChange]);

  const handleSelectedAccountChange = useCallback(
    ({
      text,
      inputType,
    }: {
      text: string;
      inputType: EInputAddressChangeType;
    }) => {
      onInputTypeChange?.(inputType);

      if (singleLine) {
        handleChangeText(text);
      } else {
        // In multi-line mode, append the address on a new line
        const newValue = value ? `${value}\n${text}` : text;
        handleChangeText(newValue);
      }
    },
    [handleChangeText, onInputTypeChange, singleLine, value],
  );

  const contentPaddingLeft = showLineNumbers
    ? PADDING_HORIZONTAL_WITH_LINE_NUMBERS
    : PADDING_HORIZONTAL;

  const styles = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      StyleSheet.create({
        textInput: platformEnv.isNative
          ? {
              // Native: TextInput is the main content, not overlaid
              flex: 1,
              paddingTop: PADDING_VERTICAL,
              paddingBottom: PADDING_VERTICAL,
              paddingLeft: contentPaddingLeft,
              paddingRight: PADDING_HORIZONTAL,
              fontSize: FONT_SIZE,
              lineHeight: LINE_HEIGHT,
              textAlignVertical: 'top',
              fontFamily: 'System',
              includeFontPadding: false,
              color: textColor,
            }
          : {
              // Web: TextInput is overlaid on display layer
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: PADDING_VERTICAL,
              paddingBottom: PADDING_VERTICAL,
              paddingLeft: contentPaddingLeft,
              paddingRight: PADDING_HORIZONTAL,
              fontSize: FONT_SIZE,
              lineHeight: LINE_HEIGHT,
              fontFamily: webFontFamily,
              textAlignVertical: 'top',
              color: 'transparent',
              caretColor: textColor,
            },
      } as any),
    [textColor, contentPaddingLeft],
  );

  return (
    <YStack ref={containerRef}>
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
          ref={scrollViewRef}
          height={height}
          maxHeight={height ?? maxHeight}
          minHeight={height ?? minHeight}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <XStack minHeight={(height ?? minHeight) - 2}>
            {/* Line numbers column - show when focused or has content */}
            {showLineNumbers ? (
              <YStack
                width={LINE_NUMBER_WIDTH}
                flexShrink={0}
                pt={
                  PADDING_VERTICAL +
                  (platformEnv.isNative ? NATIVE_LINE_NUMBER_TOP_OFFSET : 0)
                }
                pb={PADDING_VERTICAL}
              >
                {(hasContent ? lines : ['']).map((_, index) => {
                  const lineNumber = index + 1;
                  const lineHeight = lineHeights[index] || LINE_HEIGHT;
                  return (
                    <Stack
                      key={index}
                      height={lineHeight}
                      alignItems="flex-end"
                      pr="$1"
                    >
                      <SizableText
                        fontSize={FONT_SIZE}
                        lineHeight={LINE_HEIGHT}
                        color="$textDisabled"
                        userSelect="none"
                        numberOfLines={1}
                        ellipsizeMode="tail"
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
              {/* Display layer - styled text with word wrap; on native used as invisible measurement layer for line heights */}
              <YStack
                pt={PADDING_VERTICAL}
                pb={PADDING_VERTICAL}
                pl={contentPaddingLeft}
                pr={PADDING_HORIZONTAL}
                pointerEvents="none"
                {...(platformEnv.isNative
                  ? {
                      position: 'absolute' as const,
                      top: 0,
                      left: 0,
                      right: 0,
                      opacity: 0,
                    }
                  : {})}
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

              {/* Input layer - visible on native, transparent overlay on web */}
              <RNTextInput
                ref={inputRef}
                value={value}
                placeholder={platformEnv.isNative ? placeholder : undefined}
                placeholderTextColor={placeholderColor}
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={() => {
                  onInputTypeChange?.(EInputAddressChangeType.Manual);
                }}
                onChangeText={handleChangeText}
                onContentSizeChange={(e) =>
                  handleContentSizeChange(
                    e.nativeEvent.contentSize.width,
                    e.nativeEvent.contentSize.height,
                  )
                }
                editable={!disabled}
                multiline
                style={styles.textInput}
                selectionColor={selectionColor}
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
            flexWrap="wrap"
            alignItems="center"
            pt="$1"
            pb="$3"
            px="$3"
            gap="$2"
          >
            <XStack gap="$2" flex={1} flexWrap="wrap" minWidth={0}>
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
              <XStack justifyContent="flex-end" gap="$6" ml="auto">
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
                    accountSelectorOnly={accountSelector?.accountSelectorOnly}
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
