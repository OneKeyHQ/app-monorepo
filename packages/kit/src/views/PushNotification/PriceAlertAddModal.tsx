import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import B from 'bignumber.js';
import { pick } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Keyboard,
  Modal,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { PriceAlertOperator } from '@onekeyhq/engine/src/managers/notification';
import { Token } from '@onekeyhq/engine/src/types/token';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useManageTokens } from '../../hooks';
import { useSettings } from '../../hooks/redux';
import { getSuggestedDecimals } from '../../utils/priceUtils';
import {
  ManageTokenRoutes,
  ManageTokenRoutesParams,
} from '../ManageTokens/types';
import { PreSendAmountPreview } from '../Send/PreSendAmount';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.PriceAlertList
>;

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.PriceAlertAdd
>;

export const PriceAlertAddModal: FC = () => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const route = useRoute<RouteProps>();
  const { token } = route.params;
  const { height } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const { pushNotification } = useSettings();
  const navigation = useNavigation<NavigationProps>();
  const { getTokenPrice } = useManageTokens();
  const map = useAppSelector((s) => s.fiatMoney.map);
  const { selectedFiatMoneySymbol } = useSettings();
  const fiat = map[selectedFiatMoneySymbol];
  const price = new B(getTokenPrice(token) || 0).multipliedBy(fiat).toNumber();

  const { serviceNotification } = backgroundApiProxy;

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
        maximumFractionDigits: getSuggestedDecimals(+p),
        useGrouping: options?.useGrouping || false,
      }),
    [intl, selectedFiatMoneySymbol],
  );

  const suggestedDecimals = useMemo(
    () => getSuggestedDecimals(+price),
    [price],
  );

  const [text, setText] = useState(
    formatPrice(price, { style: 'decimal', useGrouping: false }),
  );
  const shortScreen = height < 768;

  const onConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await serviceNotification.addPriceAlertConfig({
        symbol: token.symbol,
        operator: new B(text).isGreaterThanOrEqualTo(price)
          ? PriceAlertOperator.greater
          : PriceAlertOperator.less,
        price: text,
        currency: selectedFiatMoneySymbol,
        ...pick(token as Required<Token>, 'impl', 'chainId', 'address'),
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
    navigation,
    selectedFiatMoneySymbol,
    text,
    token,
    price,
    serviceNotification,
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
        type: 'primary',
        leftIconName: 'PlusOutline',
        isLoading: loading,
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
            desc={intl.formatMessage(
              { id: 'content__current_price_str' },
              {
                0: formatPrice(price, {
                  style: 'currency',
                  useGrouping: true,
                }),
              },
            )}
            text={text}
            onChangeText={onTextChange}
          />
        </Box>
        <Box mt="auto">
          {(platformEnv.isNative || (platformEnv.isDev && isSmallScreen)) && (
            <Box mt={6}>
              <Keyboard
                itemHeight={shortScreen ? '44px' : undefined}
                pattern={
                  new RegExp(
                    `^(0|([1-9][0-9]*))?.?([0-9]{1,${suggestedDecimals}})?$`,
                  )
                }
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
