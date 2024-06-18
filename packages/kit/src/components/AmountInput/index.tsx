import { useMemo } from 'react';

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

type IAmountInputFormItemProps = IFormFieldProps<
  string,
  {
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
      loading?: boolean;
    };
    enableMaxAmount?: boolean;
    valueProps?: {
      value?: string;
      onPress?: () => void;
      loading?: boolean;
      currency?: string;
      moreComponent?: React.ReactNode;
    };
    balanceProps?: {
      value?: string;
      onPress?: () => void;
      loading?: boolean;
    };
    tokenSelectorTriggerProps?: {
      selectedTokenImageUri?: string;
      selectedNetworkImageUri?: string;
      selectedTokenSymbol?: string;
      loading?: boolean;
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
  ...rest
}: IAmountInputFormItemProps) {
  const intl = useIntl();

  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });

  const InputElement = useMemo(() => {
    if (inputProps?.loading)
      return (
        <Stack py="$4" px="$3.5" flex={1}>
          <Skeleton h="$6" w="$24" />
        </Stack>
      );

    return (
      <Input
        keyboardType={platformEnv.isNativeIOS ? 'numeric' : 'number-pad'}
        height="$14"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        size="large"
        focusStyle={undefined}
        containerProps={{
          flex: 1,
          borderWidth: 0,
        }}
        value={value}
        onChangeText={onChange}
        {...inputProps}
      />
    );
  }, [inputProps, onChange, value]);

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
          formatter="value"
          formatterOptions={{ currency: valueProps.currency ?? '$' }}
          size="$bodyMd"
          color="$textSubdued"
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
        flexShrink={1}
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
              bg="$bgStrong"
              delayMs={1000}
            >
              <Icon size="$6" name="CoinOutline" color="$iconDisabled" />
            </Image.Fallback>
          </Image>
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-1"
            p="$0.5"
            borderRadius="$full"
            flexShrink={1}
            bg="$bgApp"
          >
            {tokenSelectorTriggerProps?.selectedNetworkImageUri ? (
              <Image height="$3" width="$3" borderRadius="$full">
                <Image.Source
                  source={{
                    uri: tokenSelectorTriggerProps?.selectedNetworkImageUri,
                  }}
                />
                <Image.Fallback bg="$bgStrong" delayMs={1000}>
                  <Icon size="$3" name="QuestionmarkSolid" />
                </Image.Fallback>
              </Image>
            ) : null}
          </Stack>
        </Stack>
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {tokenSelectorTriggerProps?.selectedTokenSymbol ||
            intl.formatMessage({ id: ETranslations.token_selector_title })}
        </SizableText>
        {tokenSelectorTriggerProps?.onPress ? (
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
    tokenSelectorTriggerProps?.loading,
    tokenSelectorTriggerProps?.onPress,
    tokenSelectorTriggerProps?.selectedNetworkImageUri,
    tokenSelectorTriggerProps?.selectedTokenImageUri,
    tokenSelectorTriggerProps?.selectedTokenSymbol,
  ]);

  const BalanceElement = useMemo(() => {
    if (!balanceProps) {
      return null;
    }
    return balanceProps.loading ? (
      <Stack py="$1" px="$3.5">
        <Skeleton h="$3" w="$16" />
      </Stack>
    ) : (
      <XStack
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
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          Balance:
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
  }, [balanceProps, enableMaxAmount, intl]);
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
        {BalanceElement}
      </XStack>
    </Stack>
  );
}
