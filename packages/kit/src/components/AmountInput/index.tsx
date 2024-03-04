import { useMemo } from 'react';

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

type IAmountInputFormItemProps = IFormFieldProps<
  string,
  {
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
      loading?: boolean;
    };
    enableMaxAmount?: boolean;
    currency?: string;
    valueProps?: {
      value?: string;
      onPress?: () => void;
      loading?: boolean;
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
  currency = '$',
  ...rest
}: IAmountInputFormItemProps) {
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
        keyboardType="number-pad"
        height="$14"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        borderTopWidth="$0"
        borderRightWidth="$0"
        borderBottomWidth="$0"
        borderLeftWidth="$0"
        size="large"
        bg="$transparent"
        focusStyle={undefined}
        containerProps={{
          flex: 1,
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
          formatter="price"
          formatterOptions={{ currency }}
          size="$bodyMd"
          color="$textSubdued"
          pr="$1.5"
        >
          {valueProps.value || '0.00'}
        </NumberSizeableText>
        {reversible && (
          <Icon name="SwitchVerOutline" size="$4" color="$iconSubdued" />
        )}
      </>
    );
  }, [valueProps, currency, reversible]);

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
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        onPress={tokenSelectorTriggerProps?.onPress}
      >
        <Stack>
          <Image height="$7" width="$7" borderRadius="$full">
            {tokenSelectorTriggerProps?.selectedTokenImageUri && (
              <Image.Source
                source={{
                  uri: tokenSelectorTriggerProps?.selectedTokenImageUri,
                }}
              />
            )}
          </Image>
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-1"
            p="$0.5"
            borderRadius="$full"
            bg="$bgApp"
          >
            {tokenSelectorTriggerProps?.selectedNetworkImageUri && (
              <Image height="$3" width="$3" borderRadius="$full">
                <Image.Source
                  source={{
                    uri: tokenSelectorTriggerProps?.selectedNetworkImageUri,
                  }}
                />
              </Image>
            )}
          </Stack>
        </Stack>
        <SizableText size="$headingXl" pl="$2" numberOfLines={1}>
          {tokenSelectorTriggerProps?.selectedTokenSymbol || 'Select Token'}
        </SizableText>
        {tokenSelectorTriggerProps?.onPress && (
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            mr="$-1"
            color="$iconSubdued"
          />
        )}
      </XStack>
    );
  }, [
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
            {balanceProps.value}
          </NumberSizeableText>
        </SizableText>
        {enableMaxAmount && (
          <SizableText pl="$1" size="$bodyMdMedium" color="$textInteractive">
            Max
          </SizableText>
        )}
      </XStack>
    );
  }, [balanceProps, enableMaxAmount]);
  return (
    <Stack
      borderRadius="$3"
      position="relative"
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      overflow="hidden"
      style={{
        borderCurve: 'continuous',
      }}
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
