import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Image,
  Page,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import {
  EExchangeId,
  EXCHANGE_CONFIGS,
} from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useExchangeAppDetection } from '../../../hooks/useExchangeAppDetection';

import type { RouteProp } from '@react-navigation/core';
import type { ImageSourcePropType } from 'react-native';

const EXCHANGE_LOGOS: Partial<Record<EExchangeId, ImageSourcePropType>> = {
  [EExchangeId.OKX]: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_okx.png'),
  [EExchangeId.Coinbase]: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_coinbase.png'),
};

const COUNTDOWN_SECONDS = 3;

function ExchangeOpenRedirect() {
  const route =
    useRoute<
      RouteProp<
        IModalReceiveParamList,
        EModalReceiveRoutes.ExchangeOpenRedirect
      >
    >();
  const { exchangeSource, address } = route.params;
  const exchangeName = EXCHANGE_CONFIGS[exchangeSource]?.name ?? '';
  const intl = useIntl();

  const navigation = useAppNavigation();
  const { openExchangeApp } = useExchangeAppDetection();
  const { copyText } = useClipboard();

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const hasOpenedRef = useRef(false);
  const hasCopiedRef = useRef(false);

  // Copy address on mount
  useEffect(() => {
    if (!hasCopiedRef.current && address) {
      hasCopiedRef.current = true;
      copyText(address, undefined, false);
    }
  }, [address, copyText]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleOpenExchange = useCallback(async () => {
    if (hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    await openExchangeApp(exchangeSource);
    navigation.popToTop();
  }, [exchangeSource, navigation, openExchangeApp]);

  // Auto-open when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      void handleOpenExchange();
    }
  }, [countdown, handleOpenExchange]);

  return (
    <Page>
      <Page.Header title="" />
      <Page.Body>
        <YStack flex={1} justifyContent="center" alignItems="center" px="$5">
          <Image
            w="$16"
            h="$16"
            borderRadius="$4"
            mb="$5"
            source={EXCHANGE_LOGOS[exchangeSource]}
          />
          <SizableText size="$headingLg" textAlign="center" mb="$2">
            {intl.formatMessage(
              { id: ETranslations.receive_address_copied },
              { address: accountUtils.shortenAddress({ address }) },
            )}
          </SizableText>
          {countdown > 0 ? (
            <XStack alignItems="center" gap="$2">
              <Spinner size="small" />
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.receive_opening_exchange_in_seconds },
                  { exchange: exchangeName, count: countdown },
                )}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage(
          {
            id: ETranslations.receive_open_exchange,
          },
          {
            exchange: exchangeName,
          },
        )}
        onConfirm={handleOpenExchange}
        confirmButtonProps={{ variant: 'secondary' }}
      />
    </Page>
  );
}

export default ExchangeOpenRedirect;
