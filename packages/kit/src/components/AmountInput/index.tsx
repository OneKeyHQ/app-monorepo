import type { ComponentType, ReactElement } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Input,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  getFontSize,
  useMedia,
} from '@onekeyhq/components';
import type {
  IInputProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import type { IFormFieldProps } from '@onekeyhq/components/src/forms/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { NUMBER_FORMATTER } from '@onekeyhq/shared/src/utils/numberUtils';

import { LetterAvatar } from '../LetterAvatar';

import type { TextInput } from 'react-native';

// Helper function to calculate dynamic font size based on input length
// Shrinks font progressively to display full number without truncation
const getAmountFontSize = (length: number, scale = 1): number => {
  let size: number;
  if (length <= 4) size = 56;
  else if (length <= 7) size = 48;
  else if (length <= 10) size = 40;
  else if (length <= 14) size = 32;
  else if (length <= 18) size = 26;
  else if (length <= 22) size = 22;
  else if (length <= 28) size = 18;
  else size = 14;
  return Math.round(size * scale);
};

export type ITokenSelectorPopoverProps = {
  title: string;
  content:
    | ReactElement
    | ComponentType<{ isOpen?: boolean; closePopover: () => void }>
    | null;
};

export type IAmountInputFormItemProps = IFormFieldProps<
  string,
  {
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
      loading?: boolean;
    };
    enableMaxAmount?: boolean;
    maxAmountText?: string;
    valueProps?: {
      value?: string;
      color?: string;
      onPress?: () => void;
      loading?: boolean;
      currency?: string;
      tokenSymbol?: string;
      formatter?: keyof typeof NUMBER_FORMATTER;
      moreComponent?: React.ReactNode;
    };
    balanceProps?: {
      value?: string;
      popoverContent?: React.ReactNode;
      popoverTitle?: string;
      onPress?: () => void;
      loading?: boolean;
      iconText?: string;
    };
    balanceHelperProps?: {
      onPress?: () => void;
    };
    tokenSelectorTriggerProps?: {
      selectedTokenImageUri?: string;
      selectedNetworkImageUri?: string;
      selectedTokenSymbol?: string;
      selectedNetworkName?: string;
      isCustomNetwork?: boolean;
      loading?: boolean;
      disabled?: boolean;
      popover?: ITokenSelectorPopoverProps;
    } & IXStackProps;
    reversible?: boolean;
    /**
     * Layout variant:
     * - 'default': Standard layout with border, token icon on right (used in Swap)
     * - 'simple': Borderless, symbol inline after amount, balance on top (used in Send)
     */
    variant?: 'default' | 'simple';
    /** Token symbol to display inline (only for 'simple' variant) */
    tokenSymbol?: string;
    /** Token image URI to display above amount (only for 'simple' variant) */
    tokenImageUri?: string;
    /** Network image URI to display as badge on token icon (only for 'simple' variant) */
    networkImageUri?: string;
    /** Callback for percentage button selection (only for 'simple' variant) */
    onPercentageSelect?: (percent: number) => void;
    /** Extra content rendered between balance and fiat value rows (only for 'simple' variant) */
    extraContent?: React.ReactNode;
    /** Additional content in the balance row, between symbol and Max button (only for 'simple' variant) */
    balanceInfoContent?: React.ReactNode;
  } & IStackProps
>;

export type IAmountInputRef = {
  focus: () => void;
  focusPercentageButton: (percent: 25 | 50 | 75 | 100) => void;
};

function AmountInputComponent(
  {
    inputProps,
    enableMaxAmount,
    maxAmountText,
    tokenSelectorTriggerProps,
    reversible,
    onChange,
    value,
    hasError,
    valueProps,
    balanceProps,
    balanceHelperProps,
    variant = 'default',
    tokenSymbol,
    tokenImageUri,
    networkImageUri,
    onPercentageSelect,
    extraContent,
    balanceInfoContent,
    ...rest
  }: IAmountInputFormItemProps,
  ref: React.Ref<IAmountInputRef>,
) {
  const intl = useIntl();
  const isSimpleVariant = variant === 'simple';
  const { md } = useMedia();
  // Scale up font size on desktop modal breakpoint
  const fontSizeScale = md ? 1.2 : 1.5;

  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });
  const [selection, setSelection] = useState({ start: 1, end: 1 });
  const inputRef = useRef<TextInput>(null);

  // Expose focus method to parent component
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    focusPercentageButton: () => {},
  }));

  const handleChangeText = useCallback(
    (text: string) => {
      // Keep compatibility with Chinese keyboard input
      // Replace the Chinese full-width period with the standard period
      let sanitizedText = text.replace('。', '.');
      // Always keep "0" if input becomes empty
      if (sanitizedText === '') {
        sanitizedText = '0';
      }
      onChange?.(sanitizedText);
    },
    [onChange],
  );

  // For simple variant: handle input changes
  const handleSimpleChangeText = useCallback(
    (text: string) => {
      // Keep compatibility with Chinese keyboard
      let sanitizedText = text.replace('。', '.');
      // Always keep "0" if input becomes empty
      if (sanitizedText === '') {
        sanitizedText = '0';
      }
      onChange?.(sanitizedText);
    },
    [onChange],
  );

  // Display value for simple variant (no formatting, direct raw value)
  const displayValue = value ?? '';

  const InputElement = useMemo(() => {
    if (inputProps?.loading)
      return (
        <Stack py="$4" pb="$2.5" px="$3.5" flex={1}>
          <Skeleton h="$6" w="$24" />
        </Stack>
      );

    return (
      <Input
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        keyboardType="decimal-pad"
        height="$11"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        size={platformEnv.isNativeAndroid ? undefined : 'large'}
        focusVisibleStyle={undefined}
        containerProps={{
          flex: 1,
          mt: '$1.5',
          borderWidth: 0,
        }}
        value={value}
        onChangeText={platformEnv.isNative ? onChange : handleChangeText}
        // maybe should replace with ref.current.setNativeProps({ selection })
        {...inputProps}
        {...(platformEnv.isNativeAndroid && {
          selection,
          onSelectionChange: ({ nativeEvent }) => {
            setSelection(nativeEvent.selection);
          },
          onFocus: (event) => {
            setSelection({
              start: value?.length ?? 0,
              end: value?.length ?? 0,
            });
            inputProps?.onFocus?.(event);
          },
          onBlur: (event) => {
            setSelection({ start: 0, end: 0 });
            inputProps?.onBlur?.(event);
          },
        })}
      />
    );
  }, [inputProps, value, onChange, handleChangeText, selection]);

  const AmountElement = useMemo(() => {
    if (!valueProps) {
      return null;
    }

    if (valueProps.loading)
      return (
        <Stack py="$0.5">
          <Skeleton h="$3" w="$16" />
        </Stack>
      );

    return (
      <>
        <NumberSizeableText
          formatter={valueProps.formatter ?? 'value'}
          formatterOptions={{
            currency: valueProps.currency,
            tokenSymbol: valueProps.tokenSymbol,
          }}
          size="$bodySm"
          color={valueProps.color ?? '$textSubdued'}
          pr="$0.5"
        >
          {valueProps.value || '0.00'}
        </NumberSizeableText>
        {valueProps.moreComponent}
        {reversible ? (
          <Icon name="SwitchVerOutline" size="$4" color="$iconSubdued" />
        ) : null}
      </>
    );
  }, [valueProps, reversible]);

  const TokenSelectorTrigger = useMemo(() => {
    if (tokenSelectorTriggerProps?.loading) {
      return (
        <XStack p="$3.5" pb="$2" alignItems="center">
          <Skeleton w="$7" h="$7" radius="round" />
          <Stack pl="$2" py="$1.5">
            <Skeleton h="$4" w="$10" />
          </Stack>
        </XStack>
      );
    }

    const { popover: popoverProps, ...restTriggerProps } =
      tokenSelectorTriggerProps ?? {};
    const hasPopover = !!popoverProps?.content;
    const hasOnPress = !!restTriggerProps.onPress || hasPopover;

    const triggerContent = (
      <XStack
        alignItems="center"
        m="$1.5"
        mb="$0"
        p="$2"
        borderRadius="$2"
        userSelect="none"
        {...(restTriggerProps.selectedTokenSymbol && {
          maxWidth: '$44',
        })}
        {...(hasOnPress && {
          role: 'button',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        disabled={restTriggerProps.disabled}
        onPress={hasPopover ? undefined : restTriggerProps.onPress}
      >
        <Stack mr="$2">
          <Image
            size="$7"
            borderRadius="$full"
            source={{
              uri: restTriggerProps.selectedTokenImageUri,
            }}
            fallback={
              <Image.Fallback
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
                bg="$gray5"
              >
                <Icon
                  size="$6"
                  m="$1"
                  name="CryptoCoinOutline"
                  color="$iconSubdued"
                />
              </Image.Fallback>
            }
          />
          {restTriggerProps.selectedNetworkImageUri ? (
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              borderRadius="$full"
              flexShrink={1}
              bg="$bgApp"
            >
              <Image
                size="$3"
                borderRadius="$full"
                source={{
                  uri: restTriggerProps.selectedNetworkImageUri,
                }}
                fallback={
                  <Image.Fallback bg="$gray5" delayMs={1000}>
                    <Icon
                      size="$3"
                      name="QuestionmarkSolid"
                      color="$iconSubdued"
                    />
                  </Image.Fallback>
                }
              />
            </Stack>
          ) : null}
          {restTriggerProps.isCustomNetwork &&
          restTriggerProps.selectedNetworkName ? (
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              borderRadius="$full"
              flexShrink={1}
              bg="$bgApp"
            >
              <LetterAvatar
                size="$3"
                letter={restTriggerProps.selectedNetworkName[0]}
              />
            </Stack>
          ) : null}
        </Stack>
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {restTriggerProps.selectedTokenSymbol ||
            intl.formatMessage({ id: ETranslations.token_selector_title })}
        </SizableText>
        {hasOnPress && !restTriggerProps.disabled ? (
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            mr="$-1"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    );

    // Wrap with Popover if popover prop is provided
    if (hasPopover && !restTriggerProps.disabled) {
      return (
        <Popover
          title={popoverProps.title}
          renderTrigger={triggerContent}
          renderContent={popoverProps.content}
          floatingPanelProps={{
            w: '$72',
          }}
        />
      );
    }

    return triggerContent;
  }, [intl, tokenSelectorTriggerProps]);

  const BalanceElement = useMemo(() => {
    if (!balanceProps) {
      return null;
    }
    if (balanceProps.loading) {
      return (
        <Stack py="$0.5" my={7} px="$3.5">
          <Skeleton h="$3" w="$16" />
        </Stack>
      );
    }
    if (balanceProps.value) {
      const contentComponent = (
        <XStack
          alignItems="center"
          m="$1"
          px="$2.5"
          py="$1"
          borderRadius={6}
          onPress={balanceProps.onPress}
          {...(enableMaxAmount && {
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
          {...(balanceHelperProps && {
            px: '$1.5',
            mr: '$-2',
          })}
        >
          {balanceProps.iconText ? (
            <SizableText color="$textSubdued" size="$bodySm" mr="$1">
              {balanceProps.iconText}
            </SizableText>
          ) : (
            <Icon name="WalletOutline" size="$4" color="$iconSubdued" mr="$1" />
          )}
          <>
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
            >
              {balanceProps.value ?? 0}
            </NumberSizeableText>
          </>
          {enableMaxAmount ? (
            <SizableText pl="$1" size="$bodySmMedium" color="$textInteractive">
              {maxAmountText ??
                intl.formatMessage({ id: ETranslations.send_max })}
            </SizableText>
          ) : null}
        </XStack>
      );
      if (balanceProps.popoverContent) {
        return (
          <Popover
            title=""
            showHeader={false}
            renderContent={() => balanceProps.popoverContent}
            renderTrigger={contentComponent}
          />
        );
      }
      return contentComponent;
    }
    return null;
  }, [balanceHelperProps, balanceProps, enableMaxAmount, intl, maxAmountText]);

  const balanceHelper = useMemo(() => {
    if (!balanceHelperProps) {
      return null;
    }

    return (
      <Stack
        mx="$2"
        p="$1"
        borderRadius={6}
        {...(balanceHelperProps?.onPress && {
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        onPress={balanceHelperProps?.onPress}
      >
        <Icon name="InfoCircleOutline" color="$iconSubdued" size="$4" />
      </Stack>
    );
  }, [balanceHelperProps]);

  // Simple variant: borderless, symbol inline, balance card rendered externally
  if (isSimpleVariant) {
    const { leftAddOnProps: simpleLeftAddOn, ...simpleInputProps } =
      inputProps ?? {};
    const currencyLabel = simpleLeftAddOn?.label as string | undefined;

    const simpleFontSize = getAmountFontSize(
      displayValue?.length || 0,
      fontSizeScale,
    );

    return (
      <Stack alignItems="center" width="100%" {...rest}>
        {/* Amount input row */}
        {simpleInputProps?.loading ? (
          <Stack py="$4">
            <Skeleton h="$12" w="$40" />
          </Stack>
        ) : (
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
            h={Math.ceil(simpleFontSize * 1.4)}
            size="large"
            focusVisibleStyle={undefined}
            placeholder="0"
            placeholderTextColor="$textDisabled"
            value={displayValue}
            onChangeText={handleSimpleChangeText}
            textAlign="center"
            containerProps={{
              width: '100%',
              borderWidth: 0,
              bg: 'transparent',
            }}
            {...(currencyLabel && {
              leftAddOnProps: {
                label: currencyLabel,
                pr: '$0',
                pl: '$0',
                mr: '$-2',
              },
            })}
            {...(tokenSymbol && {
              addOns: [
                {
                  label: tokenSymbol,
                  pr: '$0',
                  pl: '$1',
                },
              ],
            })}
            {...simpleInputProps}
            selectionColor="#00DC84"
            cursorColor="#00DC84"
            caretColor="#00DC84"
            {...(platformEnv.isNative
              ? ({
                  selection,
                  onSelectionChange: ({ nativeEvent }) => {
                    if (displayValue === '0') {
                      setSelection({ start: 1, end: 1 });
                    } else {
                      setSelection(nativeEvent.selection);
                    }
                  },
                  onFocus: (event) => {
                    setSelection({
                      start: displayValue?.length ?? 0,
                      end: displayValue?.length ?? 0,
                    });
                    simpleInputProps?.onFocus?.(event);
                  },
                  onBlur: (event) => {
                    setSelection({ start: 0, end: 0 });
                    simpleInputProps?.onBlur?.(event);
                  },
                } as const)
              : ({
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
                } as any))}
          />
        )}

        {/* Fiat value + flip button */}
        <XStack
          alignItems="center"
          mt={md ? '$0' : '$2'}
          py="$1.5"
          px="$1"
          borderRadius="$2"
          alignSelf="center"
          disabled={valueProps?.loading}
          onPress={valueProps?.onPress}
          {...(reversible && {
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
        >
          {valueProps?.loading ? (
            <Skeleton h="$6" w="$28" />
          ) : (
            <>
              <NumberSizeableText
                formatter={valueProps?.formatter ?? 'value'}
                formatterOptions={{
                  currency: valueProps?.currency,
                  tokenSymbol: valueProps?.tokenSymbol,
                }}
                size="$headingLg"
                color={valueProps?.color ?? '$textSubdued'}
              >
                {valueProps?.value || '0.00'}
              </NumberSizeableText>
              {valueProps?.moreComponent}
              {reversible ? (
                <Icon
                  name="SwitchVerOutline"
                  size="$4"
                  color="$iconSubdued"
                  ml="$1.5"
                />
              ) : null}
            </>
          )}
        </XStack>

        {/* Extra content (CoinControl, AddressTypeSelector) */}
        {extraContent}
      </Stack>
    );
  }

  // Default variant: standard layout with border
  return (
    <Stack
      borderRadius="$3"
      position="relative"
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      overflow="hidden"
      borderCurve="continuous"
      {...rest}
    >
      <XStack alignItems="center">
        {InputElement}
        {TokenSelectorTrigger}
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <XStack
          alignItems="center"
          m="$1"
          px="$2.5"
          py="$1"
          borderRadius={6}
          disabled={balanceProps?.loading}
          onPress={valueProps?.onPress}
          {...(reversible && {
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
        >
          {AmountElement}
        </XStack>
        <XStack alignItems="center">
          {BalanceElement}
          {balanceHelper}
        </XStack>
      </XStack>
    </Stack>
  );
}

export const AmountInput = forwardRef(AmountInputComponent);
