import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type { LNURLAuthServiceResponse } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccount, useNavigation } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
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

  const {
    walletId: routeWalletId,
    networkId: routeNetworkId,
    accountId: routeAccountId,
    lnurlDetails: routeLnurlDetails,
    isSendFlow,
  } = route.params ?? {};
  const {
    sourceInfo,
    walletId: dAppWalletId,
    networkId: dAppNetworkId,
    accountId: dAppAccountId,
    lnurlDetails: dAppLnurlDetails,
  } = useDappParams();
  const walletId = isSendFlow ? routeWalletId : dAppWalletId;
  const networkId = isSendFlow ? routeNetworkId : dAppNetworkId;
  const accountId = isSendFlow ? routeAccountId : dAppAccountId;
  const lnurlDetails = isSendFlow
    ? routeLnurlDetails
    : (dAppLnurlDetails as LNURLAuthServiceResponse);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { account } = useAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const closeModal = useModalClose();

  const [messages, setMessages] = useState({
    allowText: '',
    title: '',
    actionI18nId: 'action__login__lnurl',
    successText: '',
  });

  useEffect(() => {
    if (lnurlDetails.action === 'register') {
      setMessages({
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_register_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_register',
        }),
        actionI18nId: 'action__register__lnurl',
        successText: intl.formatMessage({
          id: 'msg__lnurl_register_successful',
        }),
      });
      return;
    }
    if (lnurlDetails.action === 'link') {
      setMessages({
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_link_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_link',
        }),
        actionI18nId: 'action__link__lnurl',
        successText: intl.formatMessage({
          id: 'msg__lnurl_link_successful',
        }),
      });
      return;
    }
    if (lnurlDetails.action === 'auth') {
      setMessages({
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_connect_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_authentication',
        }),
        actionI18nId: 'action__authorize__lnurl',
        successText: intl.formatMessage({
          id: 'msg__lnurl_authorization_successful',
        }),
      });
      return;
    }
    setMessages({
      allowText: intl.formatMessage({
        id: 'content__allow_dapp_to_login_with_onekey',
      }),
      title: intl.formatMessage({
        id: 'title__lnurl_login',
      }),
      actionI18nId: 'action__login__lnurl',
      successText: intl.formatMessage({
        id: 'msg__lnurl_login_successful',
      }),
    });
  }, [lnurlDetails.action, intl]);

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
        id: 'content__request_lnurl_linkingkey',
      }),
    );
  }, [connectTip, lnurlDetails, intl]);

  const onDone = useCallback(
    async (password: string) => {
      try {
        if (!walletId) {
          throw new Error('walletId is required');
        }
        setIsLoading(true);
        await backgroundApiProxy.serviceLightningNetwork.lnurlAuth({
          password,
          walletId,
          networkId: networkId ?? '',
          lnurlDetail: lnurlDetails,
        });
        ToastManager.show({
          title: messages.successText,
        });
        setTimeout(() => {
          if (isSendFlow) {
            // quit from password modal
            closeModal();
            closeModal();
          } else {
            dappApprove.resolve({
              close: closeModal,
            });
          }
        }, 300);
      } catch (e: any) {
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
        } else {
          ToastManager.show(
            { title: (e as Error)?.message || e },
            { type: 'error' },
          );
        }
        closeModal();
        if (!isSendFlow) {
          dappApprove.reject();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      lnurlDetails,
      walletId,
      networkId,
      closeModal,
      messages.successText,
      intl,
      dappApprove,
      isSendFlow,
    ],
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
      header={messages.title}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId={messages.actionI18nId as any}
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => onConfirmWithAuth()}
      secondaryActionTranslationId="action__cancel"
      onModalClose={isSendFlow ? undefined : dappApprove.reject}
      onSecondaryActionPress={({ close }) => {
        if (isSendFlow) {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          }
        } else {
          dappApprove.reject();
          close();
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
              {messages.allowText}
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
