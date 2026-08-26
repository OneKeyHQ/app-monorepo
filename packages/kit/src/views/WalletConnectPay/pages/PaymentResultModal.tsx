import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalWalletConnectPayRoutes,
  IModalWalletConnectPayParamList,
} from '@onekeyhq/shared/src/routes';
import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useWcPayResultPolling } from '../hooks/useWcPayResultPolling';

import type { RouteProp } from '@react-navigation/core';

export function PaymentResultModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalWalletConnectPayParamList,
        EModalWalletConnectPayRoutes.PaymentResult
      >
    >();
  const { paymentId, optionId, signatures, initialResult } = route.params;
  const { result, pollExhausted } = useWcPayResultPolling({
    paymentId,
    optionId,
    signatures,
    initialResult,
    enabled: true,
  });

  // PaymentOptionsModal's result phase renders a copy of this status JSX
  // inline (the payment no longer pushes this route). Change both together —
  // or delete this screen once nothing routes to it.
  const renderStatus = () => {
    if (result.status === EWcPayStatus.Succeeded) {
      return (
        <YStack alignItems="center" gap="$3">
          <Icon name="CheckRadioSolid" size="$16" color="$iconSuccess" />
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_success })}
          </SizableText>
          {result.info?.txId ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {result.info.txId}
            </SizableText>
          ) : null}
        </YStack>
      );
    }
    if (
      result.status === EWcPayStatus.Failed ||
      result.status === EWcPayStatus.Expired ||
      result.status === EWcPayStatus.Cancelled
    ) {
      return (
        <YStack alignItems="center" gap="$3">
          <Icon name="XCircleSolid" size="$16" color="$iconCritical" />
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_failed })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {result.status}
          </SizableText>
        </YStack>
      );
    }
    return (
      <YStack alignItems="center" gap="$3">
        <Spinner size="large" />
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.global_processing })}
        </SizableText>
      </YStack>
    );
  };

  return (
    <Page>
      <Page.Header title="WalletConnect Pay" />
      <Page.Body>
        <Stack flex={1} alignItems="center" justifyContent="center" py="$10">
          {renderStatus()}
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          navigation.popStack();
        }}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
        confirmButtonProps={{ disabled: !result.isFinal && !pollExhausted }}
      />
    </Page>
  );
}
