import { useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Form,
  Heading,
  Image,
  ListView,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useForm,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { Layout } from './utils/Layout';

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

const WalletWidgetsGallery = () => {
  const [amountValue, setAmountValue] = useState('123');
  console.log(amountValue);
  const form = useForm({ defaultValues: { amount: '' } });

  return (
    <ScrollView bg="$bgApp" h="100%">
      {/* AmountInput Demo */}
      <Stack space="$5" maxWidth="$96" pb="$10">
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 1 (Send)
          </Heading>
          <AmountInput
            value={amountValue}
            onChange={setAmountValue}
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
          <AmountInput
            value={amountValue}
            onChange={setAmountValue}
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
          <AmountInput
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
          <AmountInput
            value="0.5"
            inputProps={{
              placeholder: '0',
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
          <AmountInput error />
        </Stack>
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 7 (Form)
          </Heading>
          <Form form={form}>
            <Form.Field name="amount">
              <AmountInput />
            </Form.Field>
          </Form>
          <Button
            onPress={() => {
              alert(JSON.stringify(form.getValues()));
            }}
          >
            get form values
          </Button>
        </Stack>
      </Stack>
      <Stack pb="$10" space="$5">
        <Heading size="$heading2xl">TokenListItem in TokenSearchModal</Heading>

        <Stack>
          {/* Networks filter */}
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
          {/* List – Scroll area */}
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
};

const GalleryLayout = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Default',
        element: <WalletWidgetsGallery />,
      },
    ]}
  />
);

export default GalleryLayout;
