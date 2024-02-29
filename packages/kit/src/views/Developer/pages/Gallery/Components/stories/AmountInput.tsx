/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useCallback, useEffect, useState } from 'react';

import { YStack } from 'tamagui';

import {
  Button,
  Form,
  Image,
  ListView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useForm,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { NetworksFilterItem } from '@onekeyhq/kit/src/components/NetworksFilterItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';

import { Layout } from './utils/Layout';

const GalleryLayout = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Example 1 (Send)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          return (
            <AmountInput
              value={amountValue}
              onChange={setAmountValue}
              switchProps={{
                value: '1.00',
                currency: '$',
                onPress: () => {
                  alert('onSwitchPress');
                },
              }}
              balanceProps={{
                balance: '0.5',
                onPress: () => {
                  alert('onBalancePress');
                },
              }}
              inputProps={{
                placeholder: '0',
              }}
              tokenSelectorTriggerProps={{
                selectedTokenImageUri:
                  'https://onekey-asset.com/assets/btc/btc.png',
                selectedTokenSymbol: 'BTC',
              }}
              enableMaxAmount
              reversible
            />
          );
        },
      },
      {
        title: 'Example 2 (fallback element)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          const [balanceProps, setBalanceProps] = useState({
            balance: '',
            fallback: <Spinner />,
          });
          const [switchProps, setSwitchProps] = useState({
            value: '1.00',
            currency: '$',
            onPress: () => {
              alert('onSwitchPress');
            },
            fallback: <Spinner />,
          });
          const [loading, setLoading] = useState(false);
          const showLoading = useCallback(() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
            }, 3000);
          }, []);
          const fetchSwitchValue = useCallback(() => {
            setSwitchProps((v) => ({
              ...v,
              value: '',
            }));
            setTimeout(() => {
              setSwitchProps((v) => ({
                ...v,
                value: '131231.123123',
              }));
            }, 3000);
          }, []);
          const fetchBalance = useCallback(() => {
            setBalanceProps({
              balance: '',
              fallback: <Spinner />,
            });
            setTimeout(() => {
              setBalanceProps({
                balance: '111111.2222',
                fallback: <Spinner />,
              });
            }, 3000);
          }, []);
          useEffect(() => {
            fetchBalance();
          }, [fetchBalance]);
          return (
            <YStack space="$5">
              <AmountInput
                loading={loading}
                value={amountValue}
                onChange={setAmountValue}
                switchProps={switchProps}
                balanceProps={balanceProps}
                inputProps={{
                  placeholder: '0',
                }}
                tokenSelectorTriggerProps={{
                  selectedTokenImageUri:
                    'https://onekey-asset.com/assets/btc/btc.png',
                  selectedTokenSymbol: 'BTC',
                }}
                enableMaxAmount
                reversible
              />
              <Button onPress={showLoading}>show loading</Button>
              <Button onPress={fetchSwitchValue}>fetch switch value</Button>
              <Button onPress={fetchBalance}>fetch balance</Button>
            </YStack>
          );
        },
      },
      {
        title: 'Example 3 (Swap - Empty)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          return (
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
          );
        },
      },
      {
        title: 'Example 4 (Swap - From Token)',
        element: (
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
            balanceProps={{
              balance: '0.5',
            }}
            enableMaxAmount
          />
        ),
      },
      {
        title: 'Example 5 (Swap - To Token)',
        element: (
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
            balanceProps={{
              balance: '0.5',
            }}
          />
        ),
      },
      {
        title: 'Example 6 (Error)',
        element: () => {
          const form = useForm({ defaultValues: { amount: '' } });
          return (
            <Form form={form}>
              <Form.Field
                name="amount"
                rules={{
                  required: true,
                }}
              >
                <AmountInput />
              </Form.Field>
            </Form>
          );
        },
      },
      {
        title: 'Example 7 (Form)',
        element: () => {
          const form = useForm({ defaultValues: { amount: '' } });
          return (
            <Stack space="$2">
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
          );
        },
      },
      {
        title: 'TokenListItem in TokenSearchModal',
        element: (
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
                  disabled
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
        ),
      },
    ]}
  />
);
export default GalleryLayout;
