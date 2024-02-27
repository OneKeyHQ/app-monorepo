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
  ListView,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

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

            {tokenSelectorTriggerProps?.selectedNetworkImageUri && (
              <Stack
                position="absolute"
                right="$-1"
                bottom="$-1"
                p="$0.5"
                borderRadius="$full"
                bg="$bgApp"
              >
                <Image height="$3" width="$3" borderRadius="$full">
                  <Image.Source
                    source={{
                      uri: tokenSelectorTriggerProps?.selectedNetworkImageUri,
                    }}
                  />
                </Image>
              </Stack>
            )}
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

// TokenListItem in TokenSearchModal
type ITokenListItemProps = {
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenContrastAddress?: string;
  balance?: string;
  value?: string;
} & IListItemProps;

function TokenListItem({
  tokenImageSrc,
  networkImageSrc,
  tokenName,
  tokenSymbol,
  tokenContrastAddress,
  balance,
  value,
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem userSelect="none" {...rest}>
      <ListItem.Avatar
        src={tokenImageSrc}
        cornerImageProps={{
          src: networkImageSrc,
        }}
      />
      <ListItem.Text
        flex={1}
        primary={tokenName}
        secondary={
          <XStack>
            <SizableText size="$bodyMd" color="$textSubdued" pr="$1.5">
              {tokenSymbol}
            </SizableText>
            {tokenContrastAddress && (
              <SizableText size="$bodyMd" color="$textDisabled">
                {tokenContrastAddress}
              </SizableText>
            )}
          </XStack>
        }
      />
      <ListItem.Text align="right" primary={balance} secondary={value} />
    </ListItem>
  );
}

// NetworksFilterItem
type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  tooltipContent?: string;
} & IXStackProps;

function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  tooltipContent,
  ...rest
}: INetworksFilterItemProps) {
  const BaseComponent = (
    <XStack
      justifyContent="center"
      px="$3"
      py="$1.5"
      bg={isSelected ? '$bgPrimary' : '$bgStrong'}
      borderRadius="$2"
      userSelect="none"
      style={{
        borderCurve: 'continuous',
      }}
      {...(!isSelected && {
        focusable: true,
        hoverStyle: {
          bg: '$bgStrongHover',
        },
        pressStyle: {
          bg: '$bgStrongActive',
        },
        focusStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
        },
      })}
      {...rest}
    >
      {networkImageUri && (
        <Image
          height="$6"
          width="$6"
          borderRadius="$full"
          $gtMd={{
            height: '$5',
            width: '$5',
          }}
        >
          <Image.Source
            source={{
              uri: networkImageUri,
            }}
          />
        </Image>
      )}
      {networkName && (
        <SizableText
          color={isSelected ? '$textOnColor' : '$textSubdued'}
          size="$bodyLgMedium"
          $gtMd={{
            size: '$bodyMdMedium',
          }}
        >
          {networkName}
        </SizableText>
      )}
    </XStack>
  );

  if (!tooltipContent) return BaseComponent;

  return (
    <Tooltip
      renderContent={tooltipContent}
      placement="top"
      renderTrigger={BaseComponent}
    />
  );
}

const WalletWidgetsGallery = () => (
  <ScrollView bg="$bgApp" h="100%">
    {/* AmountInput Demo */}
    <Stack p="$5" space="$5" maxWidth="$96" pb="$10">
      <Heading size="$heading2xl">AmountInput</Heading>
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
    <Stack pb="$10" space="$5">
      <Heading px="$5" size="$heading2xl">
        TokenListItem in TokenSearchModal
      </Heading>
      <Stack maxWidth={640}>
        <Stack>
          <XStack px="$5" pt="$1" pb="$3" space="$2">
            <NetworksFilterItem
              networkName="All"
              tooltipContent="All Networks"
            />
            <NetworksFilterItem
              networkImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png"
              isSelected
              tooltipContent="Ethereum"
            />
            <NetworksFilterItem
              networkImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png"
              tooltipContent="Bitcoin"
            />
            <NetworksFilterItem
              networkImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png"
              tooltipContent="Ethereum"
            />
            <NetworksFilterItem
              networkImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png"
              tooltipContent="Bitcoin"
            />
            <NetworksFilterItem networkName="12+" flex={1} />
          </XStack>
          <XStack px="$5" py="$2">
            <SizableText size="$headingSm" pr="$2">
              Network:
            </SizableText>
            <XStack>
              <Image height="$5" width="$5" borderRadius="$full">
                <Image.Source
                  source={{
                    uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
                  }}
                />
              </Image>
              <SizableText size="$bodyMd" pl="$2">
                Ethereum
              </SizableText>
            </XStack>
          </XStack>
        </Stack>
        <ListView
          estimatedItemSize={60}
          data={new Array(10).fill({
            tokenImageSrc:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
            networkImageSrc:
              'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
            tokenName: 'USD Coin',
            tokenSymbol: 'USDC',
            tokenContrastAddress: '0x1234...5678',
            balance: '89.9',
            value: '$89.75',
            onPress: () => console.log('clicked'),
          })}
          renderItem={({ item }) => <TokenListItem {...item} />}
        />
      </Stack>
    </Stack>
  </ScrollView>
);

export default WalletWidgetsGallery;
