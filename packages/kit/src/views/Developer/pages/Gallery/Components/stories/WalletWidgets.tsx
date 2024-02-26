import { getFontSize } from 'tamagui';

import type {
  IInputProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Heading,
  Icon,
  Image,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';

type IAmountInputFormItemProps = {
  inputProps?: IInputProps;
  balance?: string;
  enableMaxAmount?: boolean;
  tokenSelectorTriggerProps?: {
    selectedTokenImageUri?: string;
    selectedNetworkImageUri?: string;
    selectedTokenSymbol?: string;
  } & IXStackProps;
  reversible?: boolean;
  error?: boolean;
} & IStackProps;

function AmountInputFormItem({
  inputProps,
  balance,
  enableMaxAmount,
  tokenSelectorTriggerProps,
  reversible,
  error,
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

const WalletWidgetsGallery = () => (
  <Stack p="$5" bg="$bgApp" h="100%">
    <Stack space="$5" maxWidth="$96">
      <Stack>
        <Heading size="$headingSm" mb="$2.5">
          Example 1 (Send)
        </Heading>
        <AmountInputFormItem
          inputProps={{
            placeholder: '0',
          }}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri:
              'https://onekey-asset.com/assets/btc/btc.png',
            selectedTokenSymbol: 'BTC',
          }}
          balance="0.5"
          enableMaxAmount
          reversible
        />
      </Stack>
      <Stack>
        <Heading size="$headingSm" mb="$2.5">
          Example 2 (Swap - Empty)
        </Heading>
        <AmountInputFormItem
          tokenSelectorTriggerProps={{
            onPress: () => alert('TokenSelectorModal'),
          }}
          inputProps={{
            placeholder: '0',
          }}
        />
      </Stack>

      <Stack>
        <Heading size="$headingSm" mb="$2.5">
          Example 3 (Swap - From Token)
        </Heading>
        <AmountInputFormItem
          inputProps={{
            placeholder: '0',
          }}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
            selectedNetworkImageUri:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
            selectedTokenSymbol: 'BTC',
            onPress: () => alert('TokenSelectorModal'),
          }}
          balance="0.5"
          enableMaxAmount
        />
      </Stack>
      <Stack>
        <Heading size="$headingSm" mb="$2.5">
          Example 4 (Swap - To Token)
        </Heading>
        <AmountInputFormItem
          inputProps={{
            placeholder: '0',
            value: '0.5',
            readOnly: true,
          }}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
            selectedNetworkImageUri:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
            selectedTokenSymbol: 'BTC',
            onPress: () => alert('TokenSelectorModal'),
          }}
          balance="0.5"
        />
      </Stack>
      <Stack>
        <Heading size="$headingSm" mb="$2.5">
          Example 6 (Error)
        </Heading>
        <AmountInputFormItem error />
      </Stack>
    </Stack>
  </Stack>
);

export default WalletWidgetsGallery;
