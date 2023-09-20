/* eslint-disable global-require */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { isFunction } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  LottieView,
  Text,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useInterval } from '../../../hooks';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { openUrl } from '../../../utils/openUrl';
import { BaseSendModal } from '../components/BaseSendModal';

import type { SendModalRoutes, SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.SendFeedbackReceipt
>;

export function SendFeedbackReceipt() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const closeModal = useModalClose();
  const { networkId, accountId, type } = route.params;
  const { network, accountAddress } = useActiveSideAccount(route.params);
  const openBlockBrowser = useOpenBlockBrowser(network);
  const [count, setCount] = useState(3);
  const isExtStandaloneWindow = platformEnv.isExtensionUiStandaloneWindow;
  const isAutoClose = isExtStandaloneWindow;
  const { serviceDapp } = backgroundApiProxy;

  const handleHideSendConfirmModal = useCallback(() => {
    serviceDapp.setSendConfirmModalVisible({ visible: false });
  }, [serviceDapp]);

  useEffect(() => {
    const registerWindowUnload = isExtStandaloneWindow;
    if (registerWindowUnload) {
      window.addEventListener('beforeunload', handleHideSendConfirmModal);
    }
    return () => {
      handleHideSendConfirmModal();
      if (registerWindowUnload) {
        window.removeEventListener('beforeunload', handleHideSendConfirmModal);
      }
    };
  }, [handleHideSendConfirmModal, isExtStandaloneWindow]);

  const doClose = useCallback(() => {
    if (isFunction(route?.params?.closeModal)) {
      route?.params?.closeModal?.();
    } else {
      closeModal();
    }
    if (isExtStandaloneWindow) {
      handleHideSendConfirmModal();
    }
  }, [
    route?.params,
    isExtStandaloneWindow,
    closeModal,
    handleHideSendConfirmModal,
  ]);
  useInterval(() => {
    if (!isAutoClose) {
      return;
    }
    setCount((num) => {
      const newNum = num - 1;
      if (newNum <= 0) {
        doClose();
      }
      return newNum;
    });
  }, 1000);

  const message = useMemo(() => {
    if (type === 'Send') {
      return intl.formatMessage({ id: 'modal__transaction_submitted' });
    }
    if (type === 'SendUnconfirmed') {
      return intl.formatMessage({
        id: 'modal__transaction_submitted_unconfirmed',
      });
    }
    if (type === 'LNURLWithdraw') {
      return intl.formatMessage({ id: 'title__lnurl_withdraw_request' });
    }
    return intl.formatMessage({ id: 'msg__signature_done' });
  }, [intl, type]);

  // Display successAction on the feedback page for lightning network
  // https://github.com/lnurl/luds/blob/luds/09.md
  const renderSuccessAction = useMemo(() => {
    const { successAction } = route.params;
    if (!successAction) return null;
    if (successAction.tag === 'url') {
      return (
        <Center my={2}>
          {successAction.description && (
            <Text typography="Body2" color="text-subdued" textAlign="center">
              {successAction.description}
            </Text>
          )}
          {successAction.url && (
            <>
              <Button
                mt={4}
                type="plain"
                leftIconName="ArrowTopRightOnSquareMini"
                size="base"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="border-default"
                onPress={() => openUrl(successAction.url || '')}
              >
                {intl.formatMessage({ id: 'action__view_in_browser' })}
              </Button>
              <Text
                typography="Caption"
                color="text-subdued"
                mt={4}
                textAlign="center"
              >
                {successAction.url}
              </Text>
            </>
          )}
        </Center>
      );
    }
    if (successAction.tag === 'message') {
      return (
        <Center my={2}>
          <Text typography="Body2" color="text-subdued" textAlign="center">
            {successAction.message}
          </Text>
        </Center>
      );
    }
    if (successAction.tag === 'withdrawer') {
      return (
        <Center my={2}>
          <Text typography="Body2" color="text-subdued" textAlign="center">
            {intl.formatMessage(
              { id: 'content__str_withdraw_request_have_been_sent_to_str' },
              {
                amount: successAction.amount,
                domain: successAction.domain,
              },
            )}
          </Text>
        </Center>
      );
    }
  }, [intl, route.params]);

  return (
    <BaseSendModal
      networkId={networkId}
      accountId={accountId}
      hideBackButton
      height="auto"
      header={undefined}
      headerDescription={undefined}
      primaryActionProps={{
        children: isAutoClose
          ? `${intl.formatMessage({ id: 'action__done' })} (${count})`
          : `${intl.formatMessage({ id: 'action__done' })}`,
      }}
      onPrimaryActionPress={() => doClose()}
      hideSecondaryAction={
        !(
          openBlockBrowser.hasAvailable ||
          typeof route.params.onDetail === 'function'
        ) || type === 'Sign'
      }
      secondaryActionTranslationId="action__view_details"
      onSecondaryActionPress={() => {
        doClose();
        setTimeout(() => {
          if (route.params.onDetail) {
            route.params.onDetail?.(route?.params?.txid);
          } else if (route.params.isSingleTransformMode === false) {
            openBlockBrowser.openAddressDetails(accountAddress);
          } else {
            openBlockBrowser.openTransactionDetails(route?.params?.txid);
          }
        }, 100);
      }}
      closeAction={() => doClose()}
    >
      <VStack
        alignItems="center"
        justifyContent="center"
        flex={1}
        // bgColor="surface-neutral-default"
      >
        <Box w="200px" h="200px">
          <LottieView
            width={200}
            source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
            autoPlay
            loop={false}
          />
        </Box>
        <Text typography="DisplayMedium">{message}</Text>
        {renderSuccessAction}
        <Box h={8} />
      </VStack>
    </BaseSendModal>
  );
}
