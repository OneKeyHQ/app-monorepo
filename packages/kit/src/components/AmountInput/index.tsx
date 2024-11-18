import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Input,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  getFontSize,
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

type IAmountInputFormItemProps = IFormFieldProps<
  string,
  {
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
      loading?: boolean;
    };
    enableMaxAmount?: boolean;
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
    } & IXStackProps;
    reversible?: boolean;
  } & IStackProps
>;

export function AmountInput({
  inputProps,
  enableMaxAmount,
  tokenSelectorTriggerProps,
  reversible,
  onChange,
  value,
  name,
  hasError,
  valueProps,
  balanceProps,
  balanceHelperProps,
  ...rest
}: IAmountInputFormItemProps) {
  const intl = useIntl();

  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const handleChangeText = useCallback(
    (text: string) => {
      // Keep compatibility with Chinese keyboard input
      // Replace the Chinese full-width period with the standard period
      const sanitizedText = text.replace('。', '.');
      onChange?.(sanitizedText);
    },
    [onChange],
  );

  const InputElement = useMemo(() => {
    if (inputProps?.loading)
      return (
        <Stack py="$4" px="$3.5" flex={1}>
          <Skeleton h="$6" w="$24" />
        </Stack>
      );

    return (
      <Input
        keyboardType="decimal-pad"
        height="$14"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        size="large"
        focusVisibleStyle={undefined}
        containerProps={{
          flex: 1,
          borderWidth: 0,
        }}
        value={value}
        onChangeText={platformEnv.isNative ? onChange : handleChangeText}
        // maybe should replace with ref.current.setNativeProps({ selection })
        {...(platformEnv.isNativeAndroid && {
          selection,
          onSelectionChange: ({ nativeEvent }) =>
            setSelection(nativeEvent.selection),
          onFocus: () =>
            setSelection({
              start: value?.length ?? 0,
              end: value?.length ?? 0,
            }),
          onBlur: () => setSelection({ start: 0, end: 0 }),
        })}
        {...inputProps}
      />
    );
  }, [inputProps, value, onChange, handleChangeText, selection]);

  const AmountElement = useMemo(() => {
    if (!valueProps) {
      return null;
    }

    if (valueProps.loading)
      return (
        <Stack py="$1">
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
          size="$bodyMd"
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
        <XStack p="$3.5" alignItems="center">
          <Skeleton w="$7" h="$7" radius="round" />
          <Stack pl="$2" py="$1.5">
            <Skeleton h="$4" w="$10" />
          </Stack>
        </XStack>
      );
    }

    return (
      <XStack
        p="$3.5"
        alignItems="center"
        userSelect="none"
        {...(tokenSelectorTriggerProps?.selectedTokenSymbol && {
          maxWidth: '$48',
        })}
        {...(tokenSelectorTriggerProps?.onPress && {
          role: 'button',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        disabled={tokenSelectorTriggerProps?.disabled}
        onPress={tokenSelectorTriggerProps?.onPress}
      >
        <Stack mr="$2">
          <Image height="$7" width="$7" borderRadius="$full">
            <Image.Source
              source={{
                uri: tokenSelectorTriggerProps?.selectedTokenImageUri,
              }}
            />
            <Image.Fallback
              alignItems="center"
              justifyContent="center"
              bg="$gray5"
              delayMs={1000}
            >
              <Icon size="$6" name="CryptoCoinOutline" color="$iconSubdued" />
            </Image.Fallback>
          </Image>
          {tokenSelectorTriggerProps?.selectedNetworkImageUri ? (
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              borderRadius="$full"
              flexShrink={1}
              bg="$bgApp"
            >
              <Image height="$3" width="$3" borderRadius="$full">
                <Image.Source
                  source={{
                    uri: tokenSelectorTriggerProps?.selectedNetworkImageUri,
                  }}
                />
                <Image.Fallback bg="$gray5" delayMs={1000}>
                  <Icon
                    size="$3"
                    name="QuestionmarkSolid"
                    color="$iconSubdued"
                  />
                </Image.Fallback>
              </Image>
            </Stack>
          ) : null}
          {tokenSelectorTriggerProps?.isCustomNetwork &&
          tokenSelectorTriggerProps?.selectedNetworkName ? (
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
                letter={tokenSelectorTriggerProps.selectedNetworkName[0]}
              />
            </Stack>
          ) : null}
        </Stack>
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {tokenSelectorTriggerProps?.selectedTokenSymbol ||
            intl.formatMessage({ id: ETranslations.token_selector_title })}
        </SizableText>
        {tokenSelectorTriggerProps?.onPress &&
        !tokenSelectorTriggerProps.disabled ? (
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
  }, [
    intl,
    tokenSelectorTriggerProps?.disabled,
    tokenSelectorTriggerProps?.isCustomNetwork,
    tokenSelectorTriggerProps?.loading,
    tokenSelectorTriggerProps?.onPress,
    tokenSelectorTriggerProps?.selectedNetworkImageUri,
    tokenSelectorTriggerProps?.selectedNetworkName,
    tokenSelectorTriggerProps?.selectedTokenImageUri,
    tokenSelectorTriggerProps?.selectedTokenSymbol,
  ]);

  const BalanceElement = useMemo(() => {
    if (!balanceProps) {
      return null;
    }
    if (balanceProps.loading) {
      return (
        <Stack py="$1" px="$3.5">
          <Skeleton h="$3" w="$16" />
        </Stack>
      );
    }
    if (balanceProps.value) {
      return (
        <XStack
          alignItems="center"
          px="$3.5"
          pb="$2"
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
            pr: '$0',
          })}
        >
          {balanceProps.iconText ? (
            <SizableText color="$textSubdued" size="$bodyMd" mr="$1">
              {balanceProps.iconText}
            </SizableText>
          ) : (
            <Icon name="WalletOutline" size="$5" color="$iconSubdued" mr="$1" />
          )}
          <SizableText size="$bodyMd" color="$textSubdued">
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="balance"
            >
              {balanceProps.value ?? 0}
            </NumberSizeableText>
          </SizableText>
          {enableMaxAmount ? (
            <SizableText pl="$1" size="$bodyMdMedium" color="$textInteractive">
              {intl.formatMessage({ id: ETranslations.send_max })}
            </SizableText>
          ) : null}
        </XStack>
      );
    }
    return null;
  }, [balanceHelperProps, balanceProps, enableMaxAmount, intl]);

  const balanceHelper = useMemo(() => {
    if (!balanceHelperProps) {
      return null;
    }

    return (
      <Stack
        pl="$2"
        pr="$3"
        pb="$2"
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
        <Icon name="InfoCircleOutline" color="$iconSubdued" size="$5" />
      </Stack>
    );
  }, [balanceHelperProps]);

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
      <XStack>
        {InputElement}
        {TokenSelectorTrigger}
      </XStack>
      <XStack justifyContent="space-between">
        <XStack
          alignItems="center"
          px="$3.5"
          pb="$2"
          flex={1}
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
