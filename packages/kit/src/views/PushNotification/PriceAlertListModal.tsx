import React, { FC, useCallback, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { pick } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Modal, useTheme } from '@onekeyhq/components';
import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useSettings } from '../../hooks/redux';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import {
  ManageTokenRoutes,
  ManageTokenRoutesParams,
} from '../ManageTokens/types';

import { ListEmptyComponent } from './Empty';
import PriceItem from './PriceItem';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.PriceAlertList
>;

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.PriceAlertList
>;

const MAX_ALERT = 50;

export const PriceAlertListModal: FC = () => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PriceAlertItem[]>([]);
  const route = useRoute<RouteProps>();
  const { pushNotification } = useSettings();
  const { token } = route.params;
  const navigation = useNavigation<NavigationProps>();

  const { serviceNotification, dispatch } = backgroundApiProxy;

  const disabled = useMemo(() => data.length >= MAX_ALERT, [data.length]);

  const fetchData = useCallback(
    async (isActive = true) => {
      try {
        if (!isActive) {
          return;
        }
        setLoading(true);
        const res = await serviceNotification.queryPriceAlertList(
          pick(token, 'impl', 'chainId', 'address'),
        );
        setData(res);
      } catch (error) {
        debugLogger.common.error(
          `queryPriceAlertList failed`,
          error instanceof Error ? error?.message : error,
        );
      }
      setTimeout(() => {
        setLoading(false);
      }, 100);
    },
    [token, serviceNotification],
  );

  const onPrimaryActionPress = useCallback(() => {
    if (!pushNotification?.pushEnable) {
      dispatch(setPushNotificationConfig({ pushEnable: true }));
    }
    navigation.navigate(ManageTokenRoutes.PriceAlertAdd, {
      token,
    });
  }, [pushNotification?.pushEnable, dispatch, navigation, token]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      fetchData(isActive);
      return () => {
        isActive = false;
      };
    }, [fetchData]),
  );

  const children = useMemo(() => {
    if (!data.length || loading) {
      return <ListEmptyComponent isLoading={loading} symbol={token.symbol} />;
    }
    return (
      <Box
        w="full"
        mt="2"
        mb={6}
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {data.map((item) => (
          <PriceItem
            alert={item}
            token={token}
            divider={false}
            onRemove={() => fetchData(true)}
            {...token}
          />
        ))}
      </Box>
    );
  }, [data, themeVariant, token, fetchData, loading]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'form__price_alert',
      })}
      height="560px"
      headerDescription={token.symbol}
      hideSecondaryAction
      onPrimaryActionPress={onPrimaryActionPress}
      primaryActionProps={{
        type: disabled ? 'basic' : 'primary',
        leftIconName: 'PlusOutline',
        disabled,
      }}
      primaryActionTranslationId="action__add_alert"
      scrollViewProps={{
        children,
      }}
    />
  );
};
