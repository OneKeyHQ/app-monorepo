import { useEffect, useState } from 'react';

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
import {
  EWcPayStatus,
  type IWcPayConfirmResult,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

import type { RouteProp } from '@react-navigation/core';

const DEFAULT_POLL_MS = 3000;
const MAX_POLL_COUNT = 60;

export default function PaymentResultModal() {
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
  const [result, setResult] = useState<IWcPayConfirmResult>(initialResult);

  useEffect(() => {
    if (result.isFinal) {
      return;
    }
    let cancelled = false;
    let pollCount = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled || pollCount >= MAX_POLL_COUNT) {
        return;
      }
      pollCount += 1;
      try {
        const next =
          await backgroundApiProxy.serviceWalletConnectPay.confirmPayment({
            paymentId,
            optionId,
            signatures,
          });
        if (cancelled) {
          return;
        }
        setResult(next);
        if (!next.isFinal) {
          timer = setTimeout(poll, next.pollInMs ?? DEFAULT_POLL_MS);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, DEFAULT_POLL_MS);
        }
      }
    };

    timer = setTimeout(poll, result.pollInMs ?? DEFAULT_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, optionId, signatures]);

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
        confirmButtonProps={{ disabled: !result.isFinal }}
      />
    </Page>
  );
}
