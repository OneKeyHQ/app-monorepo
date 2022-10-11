import React, { FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { isPassphraseWallet } from '@onekeyhq/engine/src/engineUtils';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { setPushNotificationConfig } from '../../store/reducers/settings';

import { useEnabledAccountDynamicAccounts } from './hooks';

const GuideToPushFirstTime: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const goBack = useNavigationBack();
  const { dispatch, serviceNotification } = backgroundApiProxy;
  const { wallets } = useEnabledAccountDynamicAccounts();

  const addAccountDynamics = useCallback(async () => {
    let count = 0;
    for (const w of wallets) {
      for (const a of w.accounts) {
        if (count >= 50) {
          return;
        }
        if (isCoinTypeCompatibleWithImpl(a.coinType, IMPL_EVM)) {
          await serviceNotification.addAccountDynamic({
            // @ts-ignore
            passphrase: isPassphraseWallet(w),
            accountId: a.id,
            address: a.address,
            name: a.name,
          });
          count += 1;
        }
      }
    }
  }, [wallets, serviceNotification]);

  const onPrimaryActionPress = useCallback(() => {
    dispatch(
      setPushNotificationConfig({
        pushEnable: true,
        priceAlertEnable: true,
        btcAndEthPriceAlertEnable: true,
        favoriteTokensPriceAlertEnable: true,
        accountActivityPushEnable: true,
      }),
    );
    serviceNotification
      .syncPushNotificationConfig()
      .finally(addAccountDynamics)
      .finally(goBack);
  }, [goBack, dispatch, addAccountDynamics, serviceNotification]);

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
                flex={isVertical ? undefined : 1}
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
