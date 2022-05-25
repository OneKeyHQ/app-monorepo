import React, { FC, useCallback, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import useSWR from 'swr';

import {
  Box,
  Button,
  Center,
  Image,
  Keyboard,
  Modal,
  Pressable,
  Spinner,
  Text,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import MoonpayIMG from '@onekeyhq/kit/assets/MoonPay.png';
import {
  useActiveWalletAccount,
  useMoonpayPayCurrency,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';
import { getFiatCode } from '../../../utils/FiatCurrency';
import {
  buyWidgetUrl,
  getAmountInputInfo,
  sellWidgetUrl,
  signMoonpayUrl,
} from '../Service';
import { MoonpayListType, Provider } from '../types';

import { AutoSizeText } from './AutoSizeText';

type NavigationProps = ModalScreenProps<FiatPayModalRoutesParams>;
type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayRoutes.AmoutInputModal
>;

function checkVaild(text: string) {
  const pattern = /^([0-9]+|[0-9]+\.?)([0-9]{1,2})?$/;
  return pattern.test(text) || text === '';
}

export const AmountInput: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { token, type } = route.params;
  const { selectedFiatMoneySymbol } = useSettings();
  const provider: Provider = 'moonpay';
  const fiatCode = getFiatCode(provider, selectedFiatMoneySymbol);
  const cryptoCode = token.provider.moonpay;

  const displayCurrency = type === 'Buy' ? fiatCode : token.symbol;
  const [inputText, updateInputText] = useState('');
  const [descText, updateDescText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { account } = useActiveWalletAccount();

  const { height } = useWindowDimensions();
  const shortScreen = height < 768;
  const space = shortScreen ? '16px' : '24px';
  const [amountVaild, setAmountVaild] = useState(false);
  const [minAmount, setMinAmount] = useState<number>(0);
  const [maxAmount, setMaxAmount] = useState<number>(0);
  const [askPrice, setAskPrice] = useState<number>(0);

  const fiatCurrency = useMoonpayPayCurrency(fiatCode) as MoonpayListType;
  const cryptoCurrency = useMoonpayPayCurrency(cryptoCode) as MoonpayListType;

  useSWR(
    'quoteAmount',
    () => getAmountInputInfo(type, cryptoCurrency, fiatCurrency),
    {
      onSuccess: (response) => {
        if (loading) {
          setLoading(false);
        }
        setMinAmount(response?.minAmount as number);
        if (type === 'Buy') {
          setMaxAmount(response?.maxAmount as number);
        } else {
          const balance = Number(token.balance);
          setMinAmount(Math.min(balance, response?.minAmount as number));
          setMaxAmount(Math.min(balance, response?.maxAmount as number));
        }
        setAskPrice(response?.askPrice as number);
        updateDescText(
          intl.formatMessage(
            {
              id: 'form__buy_int_min_purchase',
            },
            { 0: response?.minAmount },
          ),
        );
      },
    },
  );

  const checkAmountVaild = useCallback(
    (text: string) => {
      if (text.length > 0) {
        const amount = Number(text);

        console.log('maxAmount = ', maxAmount);

        if (amount < minAmount) {
          updateDescText(() => {
            if (type === 'Buy') {
              return intl.formatMessage(
                {
                  id: 'form__buy_int_min_purchase',
                },
                { 0: minAmount },
              );
            }
            return `${intl.formatMessage(
              {
                id: 'form__sell_min_transaction_amount',
              },
              { 0: minAmount },
            )} ${token.symbol}`;
          });
          setAmountVaild(false);
        } else if (amount > maxAmount) {
          updateDescText(() => {
            if (type === 'Buy') {
              return intl.formatMessage(
                {
                  id: 'form__buy_int_max_purchase',
                },
                { 0: maxAmount },
              );
            }
            return `${intl.formatMessage(
              {
                id: 'form__sell_max_transaction_amount',
              },
              { 0: maxAmount },
            )} ${token.symbol}`;
          });
          setAmountVaild(false);
        } else {
          updateDescText(
            type === 'Buy'
              ? `≈ ${(amount / askPrice).toFixed(fiatCurrency?.precision)}  ${
                  token.symbol
                }`
              : `≈ ${(amount * askPrice).toFixed(
                  fiatCurrency?.precision,
                )}  ${fiatCurrency.code.toUpperCase()}`,
          );
          setAmountVaild(true);
        }
      } else {
        setAmountVaild(false);
      }
    },
    [
      minAmount,
      maxAmount,
      type,
      intl,
      token.symbol,
      askPrice,
      fiatCurrency?.precision,
      fiatCurrency.code,
    ],
  );

  const onChangeText = useCallback(
    (text: string) => {
      updateInputText((prev) => {
        let result = text;
        if (!checkVaild(text)) {
          result = prev;
        }
        checkAmountVaild(result);
        return result;
      });
    },
    [checkAmountVaild],
  );

  return (
    <Modal
      height="500px"
      header={`${intl.formatMessage({
        id: type === 'Buy' ? 'action__buy' : 'action__sell',
      })} ${token.symbol}`}
      headerDescription={shortenAddress(account?.address ?? '')}
      hideSecondaryAction
      footer={null}
      staticChildrenProps={{
        flex: '1',
        paddingX: '16px',
        paddingTop: '24px',
        paddingBottom: shortScreen ? '0px' : '24px',
      }}
    >
      <Box flex={1} justifyContent="space-between">
        <Box flex={1} flexDirection="column" justifyContent="center">
          <Text
            height="24px"
            textAlign="center"
            typography={{ sm: 'DisplaySmall', md: 'Body1Strong' }}
            color="text-subdued"
          >
            {displayCurrency.toUpperCase()}
          </Text>
          <Center flex={1}>
            <AutoSizeText text={inputText} onChangeText={onChangeText} />
          </Center>
          <Box height="24px">
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <Text typography="DisplaySmall" textAlign="center">
                {descText}
              </Text>
            )}
          </Box>
        </Box>

        <Box paddingBottom="24px">
          <Pressable
            mb={space}
            mt={space}
            height="76px"
            padding="16px"
            bgColor="surface-default"
            borderRadius="12px"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            disabled
          >
            <Image
              borderRadius="12px"
              width="40px"
              height="40px"
              source={MoonpayIMG}
            />
            <Box flex={1} flexDirection="column" ml="12px">
              <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                MoonPay
              </Text>
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage({ id: 'form__third_party_provider' })}
              </Text>
            </Box>
            {/* <Icon name="ChevronRightSolid" size={20} /> */}
          </Pressable>
          {platformEnv.isNative ? (
            <Keyboard
              itemHeight={shortScreen ? '44px' : undefined}
              pattern={/^([0-9]+|[0-9]+\.?)([0-9]{1,2})?$/}
              onTextChange={(text) => {
                updateInputText(text);
                checkAmountVaild(text);
              }}
            />
          ) : null}
          <Button
            type="primary"
            size="xl"
            isDisabled={!amountVaild}
            mt={platformEnv.isNative ? space : '0px'}
            onPress={async () => {
              const url =
                type === 'Buy'
                  ? buyWidgetUrl({
                      walletAddress: account?.address ?? '',
                      currencyCode: cryptoCode,
                      baseCurrencyCode: fiatCode,
                      baseCurrencyAmount: inputText,
                    })
                  : sellWidgetUrl({
                      baseCurrencyCode: cryptoCode,
                      baseCurrencyAmount: inputText,
                    });
              const signedUrl = await signMoonpayUrl(url);
              navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
                url: signedUrl,
              });
            }}
          >
            {intl.formatMessage({
              id: 'action__next',
            })}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default AmountInput;
