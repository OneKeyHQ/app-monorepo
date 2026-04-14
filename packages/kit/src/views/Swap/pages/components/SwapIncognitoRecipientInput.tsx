import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

import {
  Badge,
  IconButton,
  SizableText,
  Stack,
  XStack,
  useSelectionColor,
  useTheme,
} from '@onekeyhq/components';
import { AddressBadge } from '@onekeyhq/kit/src/components/AddressBadge';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { BaseInput } from '@onekeyhq/kit/src/components/BaseInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

type ISwapIncognitoRecipientInputProps = {
  visible: boolean;
  errorMessage?: string;
  inputText: string;
  loading: boolean;
  onOpenRecipientAddress: () => void;
  onInputChange: (text: string) => void;
  queryResult: IAddressQueryResult;
};

const NATIVE_RECIPIENT_INPUT_HORIZONTAL_PADDING = 12;
const NATIVE_RECIPIENT_INPUT_VERTICAL_PADDING = 10;
const NATIVE_RECIPIENT_INPUT_FONT_SIZE = 14;
const NATIVE_RECIPIENT_INPUT_LINE_HEIGHT = 20;
const NATIVE_RECIPIENT_INPUT_MAX_LINES = 3;
const NATIVE_RECIPIENT_INPUT_MIN_HEIGHT =
  NATIVE_RECIPIENT_INPUT_LINE_HEIGHT +
  NATIVE_RECIPIENT_INPUT_VERTICAL_PADDING * 2;
const NATIVE_RECIPIENT_INPUT_MAX_HEIGHT =
  NATIVE_RECIPIENT_INPUT_LINE_HEIGHT * NATIVE_RECIPIENT_INPUT_MAX_LINES +
  NATIVE_RECIPIENT_INPUT_VERTICAL_PADDING * 2;
const NATIVE_RECIPIENT_INPUT_RIGHT_ACTION_WIDTH = 40;

function useSwapRecipientInputWebHeight() {
  const [height, setHeight] = useState<number | undefined>();

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextBaseHeight = Math.ceil(event.nativeEvent.layout.height);

    setHeight((prevHeight) => prevHeight ?? nextBaseHeight);
  }, []);

  return {
    height,
    onLayout: handleLayout,
  };
}

function useSwapRecipientInputNativeHeight() {
  const [measuredHeight, setMeasuredHeight] = useState(
    NATIVE_RECIPIENT_INPUT_MIN_HEIGHT,
  );

  const handleMeasureLayout = useCallback((event: LayoutChangeEvent) => {
    const nextMeasuredHeight = Math.max(
      Math.ceil(event.nativeEvent.layout.height),
      NATIVE_RECIPIENT_INPUT_MIN_HEIGHT,
    );

    setMeasuredHeight((prevHeight) =>
      prevHeight === nextMeasuredHeight ? prevHeight : nextMeasuredHeight,
    );
  }, []);

  return {
    height: Math.min(measuredHeight, NATIVE_RECIPIENT_INPUT_MAX_HEIGHT),
    onMeasureLayout: handleMeasureLayout,
    scrollEnabled: measuredHeight > NATIVE_RECIPIENT_INPUT_MAX_HEIGHT,
  };
}

export function SwapIncognitoRecipientInput({
  visible,
  errorMessage,
  inputText,
  loading,
  onOpenRecipientAddress,
  onInputChange,
  queryResult,
}: ISwapIncognitoRecipientInputProps) {
  const isNative = platformEnv.isNative;
  const intl = useIntl();
  const theme = useTheme();
  const selectionColor = useSelectionColor();
  const { height: webHeight, onLayout } = useSwapRecipientInputWebHeight();
  const {
    height: nativeInputHeight,
    onMeasureLayout: onNativeMeasureLayout,
    scrollEnabled,
  } = useSwapRecipientInputNativeHeight();
  const inputHeight = isNative ? nativeInputHeight : webHeight;
  const placeholder = intl.formatMessage({
    id: ETranslations.trade_enter_receiver_address_optional,
  });
  const nativeInputTextColor = theme.text?.val;
  const nativeInputPlaceholderTextColor = theme.textPlaceholder?.val;
  const nativeTextStyle = useMemo(
    () => ({
      paddingTop: NATIVE_RECIPIENT_INPUT_VERTICAL_PADDING,
      paddingBottom: NATIVE_RECIPIENT_INPUT_VERTICAL_PADDING,
      paddingLeft: NATIVE_RECIPIENT_INPUT_HORIZONTAL_PADDING,
      paddingRight:
        NATIVE_RECIPIENT_INPUT_HORIZONTAL_PADDING +
        NATIVE_RECIPIENT_INPUT_RIGHT_ACTION_WIDTH,
      fontSize: NATIVE_RECIPIENT_INPUT_FONT_SIZE,
      lineHeight: NATIVE_RECIPIENT_INPUT_LINE_HEIGHT,
      color: nativeInputTextColor,
      includeFontPadding: false,
    }),
    [nativeInputTextColor],
  );
  const nativeInputStyle = useMemo(
    () => ({
      ...nativeTextStyle,
      height: inputHeight,
      minHeight: NATIVE_RECIPIENT_INPUT_MIN_HEIGHT,
      maxHeight: NATIVE_RECIPIENT_INPUT_MAX_HEIGHT,
      textAlignVertical: 'top' as const,
    }),
    [inputHeight, nativeTextStyle],
  );
  const inputBorderColor = errorMessage ? '$borderCritical' : '$borderStrong';

  const badgeItems = useMemo(() => {
    if (loading || queryResult.validStatus !== 'valid') {
      return null;
    }

    const interactionBadges = queryResult.addressBadges ?? [];

    if (
      !queryResult.walletAccountName &&
      !queryResult.addressBookName &&
      interactionBadges.length === 0
    ) {
      return null;
    }

    return (
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        {queryResult.walletAccountName ? (
          <Badge badgeType="success" badgeSize="sm">
            {queryResult.walletAccountName}
          </Badge>
        ) : null}
        {queryResult.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm">
            {queryResult.addressBookName}
          </Badge>
        ) : null}
        {interactionBadges.map((badge) => (
          <AddressBadge
            key={`${badge.label}-${badge.type}`}
            title={badge.label}
            badgeType={badge.type}
            content={badge.tip}
            icon={badge.icon}
          />
        ))}
      </XStack>
    );
  }, [
    loading,
    queryResult.addressBadges,
    queryResult.addressBookName,
    queryResult.validStatus,
    queryResult.walletAccountName,
  ]);

  if (!visible) {
    return null;
  }

  return (
    <Stack gap="$2">
      <Stack position="relative">
        {isNative ? (
          <Stack
            borderWidth="$px"
            borderColor={inputBorderColor}
            borderRadius="$3"
            bg="$bgApp"
            borderCurve="continuous"
            overflow="hidden"
            position="relative"
          >
            {/* Measure native wrapped text so the input grows exactly at line breaks. */}
            <Stack
              position="absolute"
              top={0}
              left={0}
              right={0}
              opacity={0}
              pointerEvents="none"
            >
              <RNText
                onLayout={onNativeMeasureLayout}
                style={nativeTextStyle}
                textBreakStrategy="simple"
              >
                {inputText || ' '}
              </RNText>
            </Stack>
            <RNTextInput
              value={inputText}
              onChangeText={onInputChange}
              multiline
              placeholder={placeholder}
              placeholderTextColor={nativeInputPlaceholderTextColor}
              scrollEnabled={scrollEnabled}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              allowFontScaling={false}
              maxFontSizeMultiplier={1}
              textBreakStrategy="simple"
              selectionColor={selectionColor}
              cursorColor={nativeInputTextColor}
              style={nativeInputStyle}
            />
          </Stack>
        ) : (
          <BaseInput
            value={inputText}
            onChangeText={onInputChange}
            numberOfLines={1}
            size="large"
            placeholder={placeholder}
            error={!!errorMessage}
            pr="$11"
            scrollEnabled={false}
            onLayout={onLayout}
            height={inputHeight}
          />
        )}
        <XStack
          position="absolute"
          top={0}
          bottom={0}
          right="$2"
          alignItems="center"
        >
          <IconButton
            variant="tertiary"
            size="small"
            icon="PeopleCircleOutline"
            onPress={onOpenRecipientAddress}
          />
        </XStack>
      </Stack>

      {errorMessage ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {errorMessage}
        </SizableText>
      ) : null}

      {badgeItems}

      {!errorMessage ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_page_recipient_modal_do_not,
          })}
        </SizableText>
      ) : null}
    </Stack>
  );
}
