import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
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
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';
import { getFiatCode } from '../../../utils/FiatCurrency';
import { buyQuoteUri } from '../Service';
import { MoonPayBuyQuotePayload, Provider } from '../types';

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
  const route = useRoute<RouteProps>();
  const { token } = route.params;
  const intl = useIntl();
  const { selectedFiatMoneySymbol } = useSettings();
  const provider: Provider = 'moonpay';
  const baseCurrencyCode = getFiatCode(provider, selectedFiatMoneySymbol);
  const [inputText, updateInputText] = useState('');
  const [descText, updateDescText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { account } = useActiveWalletAccount();

  const [amountVaild, setAmountVaild] = useState(false);

  const quoteUri = buyQuoteUri(token.provider.moonpay, 100, baseCurrencyCode);
  const { data: quoteData } = useSWR<MoonPayBuyQuotePayload>(quoteUri);

  const checkAmountVaild = useCallback(
    (text: string) => {
      if (text.length > 0 && quoteData) {
        const amount = Number(text);
        if (amount < quoteData.baseCurrency.minBuyAmount) {
          updateDescText(() =>
            intl.formatMessage(
              {
                id: 'form__buy_int_min_purchase',
              },
              { 0: quoteData.baseCurrency.minBuyAmount },
            ),
          );
          setAmountVaild(false);
        } else if (amount > quoteData.baseCurrency.maxBuyAmount) {
          updateDescText(() =>
            intl.formatMessage(
              {
                id: 'form__buy_int_max_purchase',
              },
              { 0: quoteData.baseCurrency.maxBuyAmount },
            ),
          );
          setAmountVaild(false);
        } else {
          updateDescText(
            () =>
              `≈ ${(
                (amount - quoteData.networkFeeAmount) /
                quoteData.quoteCurrencyPrice
              ).toFixed(quoteData.currency.precision)}  ${token.symbol}`,
          );
          setAmountVaild(true);
        }
      } else {
        setAmountVaild(false);
      }
    },
    [intl, quoteData, token.symbol],
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

  useEffect(() => {
    if (quoteData && loading) {
      updateDescText(() =>
        intl.formatMessage(
          {
            id: 'form__buy_int_min_purchase',
          },
          { 0: quoteData.baseCurrency.minBuyAmount },
        ),
      );
      setLoading(false);
    }
  }, [intl, loading, quoteData]);

  return (
    <Modal
      height="500px"
      header={`${intl.formatMessage({ id: 'action__buy' })} ${token.symbol}`}
      headerDescription={shortenAddress(account?.address ?? '')}
      hideSecondaryAction
      footer={null}
    >
      <Box flex={1} justifyContent="space-between">
        <Box flex={1} flexDirection="column" justifyContent="center">
          <Text
            height="24px"
            textAlign="center"
            typography={{ sm: 'DisplaySmall', md: 'Body1Strong' }}
            color="text-subdued"
          >
            {baseCurrencyCode.toUpperCase()}
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
            mt="24px"
            height="76px"
            padding="16px"
            bgColor="surface-default"
            mb="24px"
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
              pattern={/^([0-9]+|[0-9]+\.?)([0-9]{1,2})?$/}
              onTextChange={(text) => {
                updateInputText(() => text);
              }}
            />
          ) : null}
          <Button
            type="primary"
            size="xl"
            isDisabled={!amountVaild}
            mt={platformEnv.isNative ? '24px' : '0px'}
            onPress={() => {
              const baseCurrencyAmount = Number(inputText);
              const url = `https://buy-sandbox.moonpay.com?apiKey=pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp&walletAddress&=${
                account?.address ?? ''
              }&currencyCode=${
                token.provider.moonpay
              }&baseCurrencyCode=${baseCurrencyCode}&baseCurrencyAmount=${baseCurrencyAmount}`;
              navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
                url,
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
