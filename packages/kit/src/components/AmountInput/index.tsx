import {
  Icon,
  Image,
  Input,
  SizableText,
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
    balance?: string;
    enableMaxAmount?: boolean;
    tokenSelectorTriggerProps?: {
      selectedTokenImageUri?: string;
      selectedNetworkImageUri?: string;
      selectedTokenSymbol?: string;
    } & IXStackProps;
    reversible?: boolean;
    error?: boolean;
  } & IStackProps
>;

export function AmountInput({
  inputProps,
  balance,
  enableMaxAmount,
  tokenSelectorTriggerProps,
  reversible,
  error,
  onChange,
  value,
  ...rest
}: IAmountInputFormItemProps) {
  const sharedStyles = getSharedInputStyles({
    error,
  });

  return (
    <Stack
      borderRadius="$3"
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
          <SizableText size="$bodyMd" color="$textSubdued" pr="$1.5">
            $0.00
          </SizableText>
          {reversible && (
            <Icon name="SwitchVerOutline" size="$4" color="$iconSubdued" />
          )}
        </XStack>
        {balance && (
          <XStack
            px="$3.5"
            pb="$2"
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
              Balance: {balance}
            </SizableText>
            {enableMaxAmount && (
              <SizableText
                pl="$1"
                size="$bodyMdMedium"
                color="$textInteractive"
              >
                Max
              </SizableText>
            )}
          </XStack>
        )}
      </XStack>
    </Stack>
  );
}
