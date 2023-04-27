import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import B from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Keyboard,
  Modal,
  Pressable,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { PriceAlertOperator } from '@onekeyhq/engine/src/managers/notification';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useSettings } from '../../hooks/redux';
import { useCurrentNetworkTokenInfoByCoingeckoId } from '../../hooks/useTokens';
import { getSuggestedDecimals } from '../../utils/priceUtils';
import { PreSendAmountPreview } from '../Send/modals/PreSendAmount';

import type { ManageTokenModalRoutes } from '../../routes/routesEnum';
import type { ManageTokenRoutesParams } from '../ManageTokens/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.PriceAlertList
>;

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.PriceAlertAdd
>;

export const PriceAlertAddModal: FC = () => {
  const intl = useIntl();

  const [loading, setLoading] = useState(false);
  const route = useRoute<RouteProps>();
  const { token, alerts, price } = route.params;
  const { height } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const { pushNotification } = useSettings();
  const navigation = useNavigation<NavigationProps>();

  const tokenInfo = useCurrentNetworkTokenInfoByCoingeckoId(
    token.coingeckoId ?? '',
  );
  const { selectedFiatMoneySymbol } = useSettings();

  const { serviceNotification } = backgroundApiProxy;

  const maxDecimals = useMemo(() => getSuggestedDecimals(+price), [price]);

  const formatPrice = useCallback(
    (
      p: string | number,
      options: { style?: 'currency' | 'decimal'; useGrouping: boolean },
    ) =>
      intl.formatNumber(+(p || 0), {
        currencyDisplay: 'narrowSymbol',
        style: options?.style || 'currency',
        currency: selectedFiatMoneySymbol,
        minimumFractionDigits: 2,
        maximumFractionDigits: maxDecimals,
        useGrouping: options?.useGrouping || false,
      }),
    [intl, selectedFiatMoneySymbol, maxDecimals],
  );

  const [text, setText] = useState('');
  const shortScreen = height < 768;
  const disabled = loading || !text;
  const placeholder = useMemo(
    () =>
      formatPrice(price, {
        style: 'decimal',
        useGrouping: false,
      }),
    [formatPrice, price],
  );

  const AmountPreviewDesc = useMemo(
    () => (
      <Pressable
        onPress={() => {
          setText(placeholder);
        }}
        w="100%"
        flexDirection="row"
      >
        <Typography.Body1Strong textAlign="center" flex="1">
          {intl.formatMessage(
            { id: 'content__current_price_str' },
            {
              0: formatPrice(price, {
                style: 'currency',
                useGrouping: true,
              }),
            },
          )}
        </Typography.Body1Strong>
      </Pressable>
    ),
    [formatPrice, intl, price, placeholder],
  );

  const onConfirm = useCallback(async () => {
    const newPrice = formatPrice(new B(text).toFixed(maxDecimals), {
      style: 'decimal',
      useGrouping: false,
    });
    const currency = selectedFiatMoneySymbol;
    if (alerts.find((a) => a.price === newPrice && a.currency === currency)) {
      if (navigation.canGoBack?.()) navigation.goBack();
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__alert_already_exists' }),
      });
      return;
    }
    setLoading(true);
    try {
      await serviceNotification.addPriceAlertConfig({
        symbol: token.symbol ?? tokenInfo?.symbol,
        logoURI: token.logoURI ?? tokenInfo?.logoURI,
        operator: new B(text).isGreaterThanOrEqualTo(price)
          ? PriceAlertOperator.greater
          : PriceAlertOperator.less,
        price: newPrice,
        currency: selectedFiatMoneySymbol,
        coingeckoId: token.coingeckoId ?? '',
      });
    } catch (error) {
      debugLogger.common.error(
        'changePriceAlertConfig',
        error instanceof Error ? error?.message : error,
      );
    }
    setTimeout(() => {
      setLoading(false);
      if (navigation.canGoBack?.()) navigation.goBack();
    }, 100);
  }, [
    intl,

    alerts,
    maxDecimals,
    navigation,
    selectedFiatMoneySymbol,
    text,
    token,
    tokenInfo,
    price,
    serviceNotification,
    formatPrice,
  ]);

  const onTextChange = (value: string) => {
    setText(value);
  };

  useEffect(() => {
    if (!pushNotification?.pushEnable && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [pushNotification?.pushEnable, navigation]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'form__price_alert',
      })}
      height="560px"
      headerDescription={token.symbol}
      hideSecondaryAction
      onPrimaryActionPress={onConfirm}
      primaryActionProps={{
        type: disabled ? 'basic' : 'primary',
        leftIconName: 'PlusOutline',
        isLoading: loading,
        disabled,
      }}
      primaryActionTranslationId="action__add_alert"
    >
      <Box
        flex={1}
        flexDirection="column"
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
      >
        <Box
          py={isSmallScreen ? 4 : undefined}
          my={6}
          flex={1}
          justifyContent="center"
        >
          <PreSendAmountPreview
            title={intl.formatMessage({ id: 'content__when_price_reaches' })}
            desc={AmountPreviewDesc}
            text={text}
            placeholder={placeholder}
            onChangeText={onTextChange}
          />
        </Box>
        <Box mt="auto">
          {(platformEnv.isNative || (platformEnv.isDev && isSmallScreen)) && (
            <Box mt={6}>
              <Keyboard
                itemHeight={shortScreen ? '44px' : undefined}
                pattern={/^(0|([1-9][0-9]*))?.?([0-9]+)?$/}
                text={text}
                onTextChange={onTextChange}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
};
