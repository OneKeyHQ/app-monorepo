import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { setGuideToPushFistTime } from '../../store/reducers/status';
import { wait } from '../../utils/helper';

import { useEvmWalletsAndAccounts } from './hooks';
import { PushNotificationRoutes } from './types';

export function GuideToPushFirstTimeCheck() {
  const navigation = useAppNavigation();
  const { serviceBootstrap } = backgroundApiProxy;
  const focusHandler = useCallback(() => {
    let isActive = true;
    const func = async () => {
      await wait(1000);
      const res = await serviceBootstrap.checkShouldShowNotificationGuide();
      if (!isActive) {
        return;
      }
      if (res) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.PushNotification,
          params: {
            screen: PushNotificationRoutes.GuideToPushFirstTime,
          },
        });
      }
    };
    func();
    return () => {
      isActive = false;
    };
  }, [navigation, serviceBootstrap]);
  useFocusEffect(focusHandler);
  return null;
}

const GuideToPushFirstTime: FC = () => {
  const intl = useIntl();

  const { dispatch, serviceNotification } = backgroundApiProxy;
  const { wallets } = useEvmWalletsAndAccounts();

  useEffect(() => {
    dispatch(setGuideToPushFistTime(true));
  }, [dispatch]);

  const addAccountDynamics = useCallback(async () => {
    const accounts = wallets
      .map((w) =>
        w.accounts.map((a) => ({
          ...a,
          // @ts-ignore
          passphrase: isPassphraseWallet(w),
        })),
      )
      .flat()
      .slice(0, 50);

    const filteredAccountAddress =
      await serviceNotification.filterContractAddresses(
        accounts.map((a) => a.address),
      );

    await serviceNotification.addAccountDynamicBatch({
      data: accounts
        .filter((a) => filteredAccountAddress.some((f) => f === a.address))
        .map((a) => ({
          passphrase: a.passphrase,
          accountId: a.id,
          address: a.address,
          name: a.name,
        })),
    });
  }, [wallets, serviceNotification]);

  const onPrimaryActionPress = useCallback(
    async ({ close }: { close: () => void }) => {
      close?.();
      dispatch(
        setPushNotificationConfig({
          pushEnable: true,
          priceAlertEnable: true,
          btcAndEthPriceAlertEnable: true,
          favoriteTokensPriceAlertEnable: true,
          accountActivityPushEnable: true,
        }),
      );
      try {
        await serviceNotification.syncPushNotificationConfig();
        await addAccountDynamics();
      } catch (error) {
        debugLogger.notification.error(
          'close notification addAccountDynamics error',
          error,
        );
      }
    },
    [dispatch, addAccountDynamics, serviceNotification],
  );

  const configs = useMemo(
    () => [
      {
        icon: '🚨',
        title: intl.formatMessage({ id: 'form__price_volatility' }),
        desc: intl.formatMessage({ id: 'form__price_volatility_desc' }),
      },
      {
        icon: '📈',
        title: intl.formatMessage({ id: 'form__price_alert' }),
        desc: intl.formatMessage(
          { id: 'title__no_alert_desc' },
          {
            0: 'tokens',
          },
        ),
      },
      {
        icon: '👤',
        title: intl.formatMessage({ id: 'form__account_activity' }),
        desc: intl.formatMessage({ id: 'account_activity_desc' }),
      },
    ],
    [intl],
  );

  return (
    <Modal
      height="560px"
      hideSecondaryAction
      onPrimaryActionPress={onPrimaryActionPress}
      primaryActionProps={{
        type: 'primary',
      }}
      primaryActionTranslationId="action__allow"
    >
      <VStack position="relative" height="full">
        <Center position="absolute" bottom="-12px" width="full">
          <Typography.Body2>
            {intl.formatMessage({
              id: 'content__you_can_change_this_option_later_in_the_settings',
            })}
          </Typography.Body2>
        </Center>
        <Center>
          <Text fontSize={56}>🔔</Text>
          <Typography.DisplayLarge>
            {intl.formatMessage({ id: 'title__notifications' })}
          </Typography.DisplayLarge>
        </Center>
        {configs.map((c, idx) => (
          <Box
            px="4"
            key={c.icon}
            flexDirection="row"
            mt={idx === 0 ? '64px' : 4}
          >
            <Typography.DisplayLarge mr="4">{c.icon}</Typography.DisplayLarge>
            <Box flex={1}>
              <Typography.Body1Strong mb="1">{c.title}</Typography.Body1Strong>
              <Typography.Body2
                flex={platformEnv.isNative ? undefined : 1}
                numberOfLines={2}
                color="text-subdued"
              >
                {c.desc}
              </Typography.Body2>
            </Box>
          </Box>
        ))}
      </VStack>
    </Modal>
  );
};

export default GuideToPushFirstTime;
