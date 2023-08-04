import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Center,
  Divider,
  HStack,
  Icon,
  Modal,
  Text,
  ToastManager,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccount, useNavigation } from '../../../hooks';
import { SendModalRoutes } from '../../../routes/routesEnum';
import { LNModalDescription } from '../components/LNModalDescription';

import type { SendRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { LnUrlAuthenticationParams } from '../../Send/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLAuth>;

const LNURLAuth = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { walletId, networkId, accountId, lnurlDetails } = route.params ?? {};
  const { account } = useAccount({ accountId, networkId });

  const [isLoading, setIsLoading] = useState(false);

  const closeModal = useModalClose();

  const allowText = useMemo(() => {
    if (lnurlDetails.action === 'register') {
      return intl.formatMessage({
        id: 'content__allow_dapp_to_register_with_onekey',
      });
    }
    if (lnurlDetails.action === 'link') {
      return intl.formatMessage({
        id: 'content__allow_dapp_to_link_with_onekey',
      });
    }
    if (lnurlDetails.action === 'auth') {
      return intl.formatMessage({
        id: 'content__allow_dapp_to_connect_with_onekey',
      });
    }
    return intl.formatMessage({
      id: 'content__allow_dapp_to_login_with_onekey',
    });
  }, [lnurlDetails, intl]);

  const title = useMemo(() => {
    if (lnurlDetails.action === 'register') {
      return intl.formatMessage({
        id: 'title__lnurl_register',
      });
    }
    if (lnurlDetails.action === 'link') {
      return intl.formatMessage({
        id: 'title__lnurl_link',
      });
    }
    if (lnurlDetails.action === 'auth') {
      return intl.formatMessage({
        id: 'title__lnurl_authentication',
      });
    }
    return intl.formatMessage({
      id: 'title__lnurl_login',
    });
  }, [lnurlDetails, intl]);

  const actionI18nId = useMemo(() => {
    if (lnurlDetails.action === 'register') {
      return 'action__register__lnurl';
    }
    if (lnurlDetails.action === 'link') {
      return 'action__link__lnurl';
    }
    if (lnurlDetails.action === 'auth') {
      return 'action__authorize__lnurl';
    }
    return 'action__login__lnurl';
  }, [lnurlDetails]);

  const successText = useMemo(() => {
    if (lnurlDetails.action === 'register') {
      return intl.formatMessage({
        id: 'msg__lnurl_register_successful',
      });
    }
    if (lnurlDetails.action === 'link') {
      return intl.formatMessage({
        id: 'msg__lnurl_link_successful',
      });
    }
    if (lnurlDetails.action === 'auth') {
      return intl.formatMessage({
        id: 'msg__lnurl_authorization_successful',
      });
    }
    return intl.formatMessage({
      id: 'msg__lnurl_login_successful',
    });
  }, [lnurlDetails, intl]);

  const connectTip = useCallback(
    (icon: ICON_NAMES, text: string) => (
      <HStack alignItems="flex-start">
        <Center
          bgColor="surface-success-subdued"
          borderRadius="full"
          width={9}
          height={9}
        >
          <Icon size={20} color="icon-success" name={icon} />
        </Center>

        <Text ml={4} typography="Body1" color="text-default">
          {text}
        </Text>
      </HStack>
    ),
    [],
  );

  const renderConnectTips = useMemo(() => {
    if (lnurlDetails.action === 'auth') {
      return (
        <VStack space={4}>
          {connectTip(
            'EyeOutline',
            intl.formatMessage({
              id: 'content__watch_your_account_balance_and_activity',
            }),
          )}
          {connectTip(
            'CheckSolid',
            intl.formatMessage({
              id: 'content__allow_dapp_to_register_with_onekey',
            }),
          )}
          {connectTip(
            'CheckSolid',
            intl.formatMessage({
              id: 'content__request_invoices_and_send_transaction',
            }),
          )}
        </VStack>
      );
    }
    return connectTip(
      'CheckSolid',
      intl.formatMessage({
        id: 'content__allow_dapp_to_register_with_onekey',
      }),
    );
  }, [connectTip, lnurlDetails, intl]);

  const onDone = useCallback(
    async (password: string) => {
      try {
        setIsLoading(true);
        await backgroundApiProxy.serviceLightningNetwork.lnurlAuth({
          password,
          walletId,
          lnurlDetail: lnurlDetails,
        });
        ToastManager.show({
          title: successText,
        });
        setTimeout(() => {
          // quit from password modal
          closeModal();
          closeModal();
        }, 300);
      } catch (e) {
        ToastManager.show(
          { title: e instanceof Error ? e.message : e },
          { type: 'error' },
        );
        // quit from password modal
        closeModal();
      } finally {
        setIsLoading(false);
      }
    },
    [lnurlDetails, walletId, closeModal, successText],
  );

  const onConfirmWithAuth = useCallback(
    () =>
      navigation.navigate(SendModalRoutes.LNURLAuthentication, {
        walletId,
        onDone,
      } as LnUrlAuthenticationParams),
    [walletId, navigation, onDone],
  );

  return (
    <Modal
      header={title}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId={actionI18nId}
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => onConfirmWithAuth()}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Box>
            <Box>
              <Text typography="Body2Strong">
                {intl.formatMessage({ id: 'form__request_from' })}
              </Text>
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="flex-start"
                alignItems="flex-start"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="border-default"
                borderRadius="xl"
                mt={1}
                py={2}
                px={3}
                bgColor="action-secondary-default"
              >
                <Text typography="Body1Strong" color="text-default">
                  {lnurlDetails.domain}
                </Text>
                <Text
                  typography="Body2Mono"
                  color="text-subdued"
                  lineHeight="1.5em"
                >
                  {new URL(lnurlDetails.url).host}
                </Text>
              </Box>
            </Box>
            <Text my={4} typography="Heading">
              {allowText}
            </Text>
            <Box py={4}>{renderConnectTips}</Box>
            <Divider my={4} />
            <HStack alignItems="center" justifyContent="space-between">
              <Text typography="Body2Strong" color="text-subdued">
                Account
              </Text>
              <Text typography="Body2Strong">{account?.name}</Text>
            </HStack>
          </Box>
        ),
      }}
    />
  );
};

export default LNURLAuth;
