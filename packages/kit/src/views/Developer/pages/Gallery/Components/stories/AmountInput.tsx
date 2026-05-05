/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useCallback, useState } from 'react';

import {
  Button,
  Form,
  Image,
  ListView,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { NetworksFilterItem } from '@onekeyhq/kit/src/components/NetworksFilterItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';

import { Layout } from './utils/Layout';

const AUTO_SIZE_SHORT_VALUE = '0.1234';
const AUTO_SIZE_LONG_VALUE = '12345678901234567890.12345678';
const AUTO_SIZE_SHORT_SYMBOL = 'BTC';
const AUTO_SIZE_LONG_SYMBOL = 'SUPER-LONG-TOKEN-SYMBOL';
const AUTO_SIZE_SHORT_PREFIX = '$';
const AUTO_SIZE_LONG_PREFIX = '~US$';
const BTC_CHAIN_IMAGE_URI = 'https://uni.onekey-asset.com/static/chain/btc.png';
const ETH_CHAIN_IMAGE_URI = 'https://uni.onekey-asset.com/static/chain/eth.png';
const POLYGON_CHAIN_IMAGE_URI =
  'https://uni.onekey-asset.com/static/chain/polygon.png';
const POLYGON_TOKEN_IMAGE_URI =
  'https://common.onekey-asset.com/token/evm-1/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0.jpg';

function AutoSizeAmountInputGalleryExample() {
  const [affixMode, setAffixMode] = useState<'prefix' | 'suffix'>('suffix');
  const [amountMode, setAmountMode] = useState<'short' | 'long'>('short');
  const [affixLengthMode, setAffixLengthMode] = useState<'short' | 'long'>(
    'short',
  );
  const [value, setValue] = useState(AUTO_SIZE_SHORT_VALUE);
  let tokenSymbol = '';
  if (affixMode === 'suffix') {
    tokenSymbol =
      affixLengthMode === 'short'
        ? AUTO_SIZE_SHORT_SYMBOL
        : AUTO_SIZE_LONG_SYMBOL;
  }

  let currencyLabel = '';
  if (affixMode === 'prefix') {
    currencyLabel =
      affixLengthMode === 'short'
        ? AUTO_SIZE_SHORT_PREFIX
        : AUTO_SIZE_LONG_PREFIX;
  }

  return (
    <YStack gap="$4">
      <Stack
        px="$4"
        py="$5"
        height={280}
        justifyContent="center"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <SendAutoSizeAmountInput
          value={value}
          onChange={setValue}
          tokenSymbol={tokenSymbol}
          inputProps={{
            placeholder: '0',
            leftAddOnProps: currencyLabel
              ? {
                  label: currencyLabel,
                }
              : undefined,
          }}
          valueProps={{
            value: '123,456.78',
            currency: '$',
          }}
        />
      </Stack>
      <XStack gap="$4" alignItems="flex-start">
        <YStack flex={1} minWidth={0} gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            Affix
          </SizableText>
          <SegmentControl
            fullWidth
            value={affixMode}
            onChange={(nextValue) => {
              setAffixMode(nextValue as 'prefix' | 'suffix');
            }}
            options={[
              { label: 'Prefix', value: 'prefix' },
              { label: 'Suffix', value: 'suffix' },
            ]}
          />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            Amount
          </SizableText>
          <SegmentControl
            fullWidth
            value={amountMode}
            onChange={(nextValue) => {
              const nextAmountMode = nextValue as 'short' | 'long';
              setAmountMode(nextAmountMode);
              setValue(
                nextAmountMode === 'short'
                  ? AUTO_SIZE_SHORT_VALUE
                  : AUTO_SIZE_LONG_VALUE,
              );
            }}
            options={[
              { label: 'Short', value: 'short' },
              { label: 'Long', value: 'long' },
            ]}
          />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            Affix Length
          </SizableText>
          <SegmentControl
            fullWidth
            value={affixLengthMode}
            onChange={(nextValue) => {
              setAffixLengthMode(nextValue as 'short' | 'long');
            }}
            options={[
              { label: 'Short', value: 'short' },
              { label: 'Long', value: 'long' },
            ]}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}

const AmountInputGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="AmountInput"
    elements={[
      {
        title: 'Example 1 (Send)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          return (
            <AmountInput
              value={amountValue}
              onChange={setAmountValue}
              valueProps={{
                value: '1.00',
                onPress: () => {
                  alert('onSwitchPress');
                },
                currency: '$',
              }}
              balanceProps={{
                value: '0.5',
                onPress: () => {
                  alert('onBalancePress');
                },
              }}
              inputProps={{
                placeholder: '0',
              }}
              tokenSelectorTriggerProps={{
                selectedTokenImageUri: BTC_CHAIN_IMAGE_URI,
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
          const [value, setValue] = useState('');
          const [tokenSelectorTriggerProps, setTokenSelectorTriggerProps] =
            useState({
              selectedTokenImageUri: BTC_CHAIN_IMAGE_URI,
              selectedTokenSymbol: 'BTC',
            });
          const [balanceProps, setBalanceProps] = useState({
            balance: '',
            onPress: () => {
              alert('onBalancePress');
            },
          });
          const [valueProps, setValueProps] = useState({
            value: '1.00',
            onPress: () => {
              alert('onAmountPress');
            },
          });
          const [loading, setLoading] = useState(false);
          const fetchValue = useCallback(() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
            }, 3000);
          }, []);
          const fetchToken = useCallback(() => {
            setTokenSelectorTriggerProps((v) => ({
              ...v,
              loading: true,
            }));
            setTimeout(() => {
              setTokenSelectorTriggerProps((v) => ({
                ...v,
                loading: false,
              }));
            }, 3000);
          }, []);
          const fetchAmount = useCallback(() => {
            setValueProps((v) => ({
              ...v,
              loading: true,
            }));
            setTimeout(() => {
              setValueProps((v) => ({
                ...v,
                value: '131231.123123',
                loading: false,
              }));
            }, 3000);
          }, []);
          const fetchBalance = useCallback(() => {
            setBalanceProps((v) => ({
              ...v,
              loading: true,
            }));
            setTimeout(() => {
              setBalanceProps((v) => ({
                ...v,
                balance: '111111.2222',
                loading: false,
              }));
            }, 3000);
          }, []);
          return (
            <YStack gap="$5">
              <AmountInput
                value={value}
                onChange={setValue}
                valueProps={valueProps}
                balanceProps={balanceProps}
                inputProps={{
                  placeholder: '0',
                  loading,
                }}
                tokenSelectorTriggerProps={tokenSelectorTriggerProps}
                enableMaxAmount
                reversible
              />
              <Button onPress={fetchValue}>Amount loading</Button>
              <Button onPress={fetchToken}>Token loading</Button>
              <Button onPress={fetchAmount}>Value loading</Button>
              <Button onPress={fetchBalance}>Balance loading</Button>
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
              valueProps={{}}
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
            valueProps={{}}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: POLYGON_TOKEN_IMAGE_URI,
              selectedNetworkImageUri: POLYGON_CHAIN_IMAGE_URI,
              selectedTokenSymbol: 'POL',
              onPress: () => alert('TokenSelectorModal'),
            }}
            balanceProps={{
              value: '0.5',
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
            valueProps={{}}
            inputProps={{
              placeholder: '0',
              readonly: true,
            }}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: POLYGON_TOKEN_IMAGE_URI,
              selectedNetworkImageUri: POLYGON_CHAIN_IMAGE_URI,
              selectedTokenSymbol: 'POL',
              onPress: () => alert('TokenSelectorModal'),
            }}
            balanceProps={{
              value: '0.5',
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
                <AmountInput
                  valueProps={{}}
                  balanceProps={{
                    value: '0.5',
                  }}
                />
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
            <Stack gap="$2">
              <Form form={form}>
                <Form.Field name="amount">
                  <AmountInput
                    valueProps={{}}
                    balanceProps={{
                      value: '0.5',
                    }}
                  />
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
        title: 'Example 8 (Send autosize)',
        element: <AutoSizeAmountInputGalleryExample />,
      },
      {
        title: 'TokenListItem in TokenSearchModal',
        element: (
          <Stack>
            {/* Networks filter */}
            <Stack>
              <XStack px="$5" pt="$1" pb="$3" gap="$2">
                <NetworksFilterItem
                  networkName="All"
                  tooltipContent="All Networks"
                />
                <NetworksFilterItem
                  networkImageUri={ETH_CHAIN_IMAGE_URI}
                  isSelected
                  tooltipContent="Ethereum"
                />
                <NetworksFilterItem
                  networkImageUri={BTC_CHAIN_IMAGE_URI}
                  tooltipContent="Bitcoin"
                />
                <NetworksFilterItem
                  networkImageUri={ETH_CHAIN_IMAGE_URI}
                  tooltipContent="Ethereum"
                />
                <NetworksFilterItem
                  networkImageUri={BTC_CHAIN_IMAGE_URI}
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
                  <Image
                    size="$5"
                    borderRadius="$full"
                    source={{
                      uri: ETH_CHAIN_IMAGE_URI,
                    }}
                  />
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
                tokenImageSrc: POLYGON_TOKEN_IMAGE_URI,
                networkImageSrc: POLYGON_CHAIN_IMAGE_URI,
                tokenName: 'Polygon Ecosystem Token',
                tokenSymbol: 'POL',
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
export default AmountInputGallery;
