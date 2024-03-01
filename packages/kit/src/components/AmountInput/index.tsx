import { useMemo } from 'react';

import { AnimatePresence } from 'tamagui';

import {
  Icon,
  Image,
  Input,
  NumberSizeableText,
  SizableText,
  Spinner,
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
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'>;
    enableMaxAmount?: boolean;
    // loading indicator part input part
    loading?: boolean;
    currency?: string;
    amountProps?: {
      value?: string;
      onPress?: () => void;
      // loading indicator part amount part
      loading?: boolean;
    };
    balanceProps?: {
      value?: string;
      onPress?: () => void;
      // loading indicator part balance part
      loading?: boolean;
    };
    tokenSelectorTriggerProps?: {
      // loading indicator part token part
      loading?: boolean;
      selectedTokenImageUri?: string;
      selectedNetworkImageUri?: string;
      selectedTokenSymbol?: string;
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
  amountProps,
  balanceProps,
  loading,
  currency = '$',
  ...rest
}: IAmountInputFormItemProps) {
  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });

  const AmountElement = useMemo(() => {
    if (!amountProps) {
      return null;
    }
    return (
      <>
        {amountProps.loading ? (
          <Stack pr="$2">
            <Spinner />
          </Stack>
        ) : (
          <NumberSizeableText
            formatter="price"
            formatterOptions={{ currency }}
            size="$bodyMd"
            color="$textSubdued"
            pr="$1.5"
          >
            {amountProps.value || '0.00'}
          </NumberSizeableText>
        )}
        {reversible && (
          <Icon name="SwitchVerOutline" size="$4" color="$iconSubdued" />
        )}
      </>
    );
  }, [amountProps, currency, reversible]);

  const BalanceElement = useMemo(() => {
    if (!balanceProps) {
      return null;
    }
    return balanceProps.loading ? (
      <Stack pr="$6">
        <Spinner />
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
      </XStack>
      <XStack justifyContent="space-between">
        <XStack
          alignItems="center"
          px="$3.5"
          pb="$2"
          onPress={amountProps?.onPress}
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
      <AnimatePresence>
        {loading && (
          <Stack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            opacity={0.15}
            bg="$bgReverse"
            justifyContent="center"
            flex={1}
            exitStyle={{
              opacity: 0,
            }}
          >
            <Spinner color="$bgApp" />
          </Stack>
        )}
      </AnimatePresence>
    </Stack>
  );
}
