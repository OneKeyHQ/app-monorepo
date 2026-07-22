import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalWalletConnectPayRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalWalletConnectPayParamList } from '@onekeyhq/shared/src/routes';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useWcPayActionExecutor } from '../hooks/useWcPayActionExecutor';

import type { RouteProp } from '@react-navigation/core';

function formatPayAmount({
  value,
  decimals,
  symbol,
}: {
  value: string;
  decimals: number;
  symbol: string;
}) {
  return `${new BigNumber(value).shiftedBy(-decimals).toFixed()} ${symbol}`;
}

function useExpiryCountdown(expiresAt: number | undefined) {
  const [remainingSec, setRemainingSec] = useState<number | undefined>();
  useEffect(() => {
    if (!expiresAt) {
      setRemainingSec(undefined);
      return;
    }
    // expiresAt may be seconds or milliseconds epoch
    const expiresMs = expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
    const tick = () => {
      setRemainingSec(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  if (remainingSec === undefined) {
    return undefined;
  }
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PaymentOptionsPage() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalWalletConnectPayParamList,
        EModalWalletConnectPayRoutes.PaymentOptions
      >
    >();
  const { paymentLink } = route.params;
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { executeActions } = useWcPayActionExecutor();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);

  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!accountId && !indexedAccountId) {
        return undefined;
      }
      return backgroundApiProxy.serviceWalletConnectPay.getPaymentOptions({
        paymentLink,
        accountId,
        indexedAccountId,
      });
    },
    [paymentLink, accountId, indexedAccountId],
    { watchLoading: true },
  );

  const countdown = useExpiryCountdown(result?.info?.expiresAt);
  const options = result?.options ?? [];
  const selectedOption: IWcPayOption | undefined =
    options.find((o) => o.id === selectedOptionId) ?? options[0];

  const handlePay = useCallback(async () => {
    if (!result || !selectedOption || isPaying) {
      return;
    }
    setIsPaying(true);
    try {
      const { paymentId } = result;
      const optionId = selectedOption.id;

      // 1. compliance data collection must complete BEFORE fetching actions
      if (selectedOption.collectData?.url) {
        const collectData = selectedOption.collectData;
        await new Promise<void>((resolve, reject) => {
          navigation.push(EModalWalletConnectPayRoutes.DataCollection, {
            collectData,
            onComplete: () => resolve(),
            onError: (error: string) => reject(new Error(error)),
          });
        });
      }

      // 2. fetch the ordered signing actions
      const actions =
        await backgroundApiProxy.serviceWalletConnectPay.getRequiredPaymentActions(
          { paymentId, optionId },
        );

      // 3. sign sequentially; results order must match actions order
      const signatures = await executeActions({
        actions,
        accountId,
        indexedAccountId,
      });

      // 4. submit and show result
      const confirmResult =
        await backgroundApiProxy.serviceWalletConnectPay.confirmPayment({
          paymentId,
          optionId,
          signatures,
        });
      navigation.push(EModalWalletConnectPayRoutes.PaymentResult, {
        paymentId,
        optionId,
        signatures,
        initialResult: confirmResult,
      });
    } catch (error) {
      Toast.error({
        title:
          (error as Error | undefined)?.message ??
          intl.formatMessage({ id: ETranslations.global_failed }),
      });
    } finally {
      setIsPaying(false);
    }
  }, [
    result,
    selectedOption,
    isPaying,
    navigation,
    executeActions,
    accountId,
    indexedAccountId,
    intl,
  ]);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="WalletConnect Pay" />
      <Page.Body>
        {isLoading || !result ? (
          <Stack flex={1} alignItems="center" justifyContent="center" py="$10">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack px="$5" gap="$4">
            <YStack alignItems="center" gap="$1" py="$4">
              <SizableText size="$headingXl">
                {result.info?.merchant?.name ?? ''}
              </SizableText>
              {result.info?.amount ? (
                <SizableText size="$heading3xl">
                  {formatPayAmount({
                    value: result.info.amount.value,
                    decimals: result.info.amount.display.decimals,
                    symbol: result.info.amount.display.assetSymbol,
                  })}
                </SizableText>
              ) : null}
              {countdown ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {countdown}
                </SizableText>
              ) : null}
            </YStack>
            <YStack>
              {options.map((option) => (
                <ListItem
                  key={option.id}
                  title={option.amount.display.assetSymbol}
                  subtitle={option.amount.display.networkName ?? ''}
                  avatarProps={{
                    src: option.amount.display.iconUrl,
                  }}
                  checkMark={selectedOption?.id === option.id}
                  onPress={() => setSelectedOptionId(option.id)}
                >
                  <SizableText size="$bodyMdMedium">
                    {formatPayAmount({
                      value: option.amount.value,
                      decimals: option.amount.display.decimals,
                      symbol: option.amount.display.assetSymbol,
                    })}
                  </SizableText>
                </ListItem>
              ))}
              {options.length === 0 ? (
                <Stack alignItems="center" py="$8">
                  <SizableText size="$bodyLg" color="$textSubdued">
                    {intl.formatMessage({ id: ETranslations.global_failed })}
                  </SizableText>
                </Stack>
              ) : null}
            </YStack>
          </YStack>
        )}
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          void handlePay();
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          disabled: !result || !selectedOption || isPaying,
          loading: isPaying,
        }}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
      />
    </Page>
  );
}

export default function PaymentOptionsModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PaymentOptionsPage />
    </AccountSelectorProviderMirror>
  );
}
