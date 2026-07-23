import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalWalletConnectPayRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalWalletConnectPayParamList } from '@onekeyhq/shared/src/routes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  isWcPayTrustedUrl,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAction,
  IWcPayConfirmResult,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  WcPayUserCancelledError,
  useWcPayActionExecutor,
} from '../hooks/useWcPayActionExecutor';

import type { RouteProp } from '@react-navigation/core';

interface IWcPayActionProgressEntry {
  // stableStringify of the action's walletRpc (chainId+method+params);
  // proves a stored result still belongs to the same-index action when the
  // server returns a recomputed action list on retry
  fingerprint: string;
  result: string;
}

function getWcPayActionFingerprint(action: IWcPayAction): string {
  return stringUtils.stableStringify(action.walletRpc);
}

// option.account is CAIP-10 ("namespace:reference:address"); its chain part
// maps to a wallet networkId so icons/names can be resolved locally instead
// of relying on the server-provided (often missing) icon urls
function getWcPayOptionNetworkId(option: IWcPayOption): string | undefined {
  const [namespace, reference] = option.account.split(':');
  return wcPayChainIdToNetworkId(`${namespace}:${reference}`) ?? undefined;
}

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
  // expiresAt is optional in the payment info; without it there is no local
  // expiry signal and the server-reported status remains the only gate
  const isExpiredLocally = remainingSec !== undefined && remainingSec <= 0;
  if (remainingSec === undefined) {
    return { countdown: undefined, isExpiredLocally };
  }
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return {
    countdown: `${m}:${String(s).padStart(2, '0')}`,
    isExpiredLocally,
  };
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
  const [loadError, setLoadError] = useState(false);
  // per payment+option+account record of action results already produced by
  // a partially failed attempt; a retry resumes from the first incomplete
  // action instead of re-broadcasting transactions that are already on-chain
  const completedActionsRef = useRef<
    Record<string, IWcPayActionProgressEntry[]>
  >({});

  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!accountId && !indexedAccountId) {
        return undefined;
      }
      // usePromiseResult swallows rejections, which would leave the page on
      // an endless spinner; track failures explicitly to render an error state
      try {
        setLoadError(false);
        const pay =
          await backgroundApiProxy.serviceWalletConnectPay.getPaymentOptions({
            paymentLink,
            accountId,
            indexedAccountId,
          });
        // resolve wallet-side network presets once so each option can render
        // the local network icon/name even when the server omits icon urls
        const networkIds = Array.from(
          new Set(
            (pay.options ?? [])
              .map(getWcPayOptionNetworkId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          });
        const networkMap: Record<string, IServerNetwork> = {};
        for (const network of networks) {
          networkMap[network.id] = network;
        }
        return { pay, networkMap };
      } catch {
        setLoadError(true);
        return undefined;
      }
    },
    [paymentLink, accountId, indexedAccountId],
    {
      watchLoading: true,
      // an account switch re-runs this request; the stale result must not
      // survive into the loading window, or Continue could hand options
      // resolved for the previous account to the executor signing with the
      // new one
      undefinedResultIfReRun: true,
    },
  );

  const payResult = result?.pay;
  const networkMap = result?.networkMap;
  const { countdown, isExpiredLocally } = useExpiryCountdown(
    payResult?.info?.expiresAt,
  );
  const options = payResult?.options ?? [];
  const payStatus = payResult?.info?.status;
  // A payment in a final state can no longer be paid regardless of balances.
  const isPaymentInactive =
    payStatus === EWcPayStatus.Cancelled ||
    payStatus === EWcPayStatus.Expired ||
    payStatus === EWcPayStatus.Failed ||
    payStatus === EWcPayStatus.Succeeded;
  // Single gate for starting a payment, shared by the Continue button and
  // handlePay: the server must still report a payable state AND the local
  // countdown must not have hit zero (the page may outlive expiresAt while
  // the server status is stale).
  const isPaymentActionable =
    Boolean(payResult) && !isPaymentInactive && !isExpiredLocally;
  const selectedOption: IWcPayOption | undefined =
    options.find((o) => o.id === selectedOptionId) ?? options[0];

  const handlePay = useCallback(async () => {
    if (
      !payResult ||
      !selectedOption ||
      isPaying ||
      isLoading ||
      !isPaymentActionable
    ) {
      return;
    }
    setIsPaying(true);
    try {
      const { paymentId } = payResult;
      const optionId = selectedOption.id;

      // 1. compliance data collection must complete BEFORE fetching actions.
      // Prefer per-option collectData; fall back to the legacy top-level field
      // so merchants still on the old response shape are not skipped.
      const collectData = selectedOption.collectData ?? payResult.collectData;
      if (collectData) {
        // Only the hosted-url flow is supported (native field rendering is a
        // later phase). When collection is required but no hosted form is
        // available, abort instead of silently skipping compliance data and
        // proceeding to signing.
        if (!collectData.url) {
          throw new OneKeyLocalError(
            'WalletConnect Pay data collection form is unavailable',
          );
        }
        // the form URL comes from the server response; never load an
        // untrusted host into the webview/iframe presented as WC Pay
        if (!isWcPayTrustedUrl(collectData.url)) {
          throw new OneKeyLocalError(
            'Untrusted WalletConnect Pay data collection URL',
          );
        }
        await new Promise<void>((resolve, reject) => {
          navigation.push(EModalWalletConnectPayRoutes.DataCollection, {
            collectData,
            onComplete: () => resolve(),
            onError: (error: string) => reject(new OneKeyLocalError(error)),
            onCancel: () =>
              reject(new WcPayUserCancelledError('User canceled payment')),
          });
        });
      }

      // 2. fetch the ordered signing actions
      const actions =
        await backgroundApiProxy.serviceWalletConnectPay.getRequiredPaymentActions(
          { paymentId, optionId },
        );

      // 3. sign sequentially; results order must match actions order.
      // Progress is recorded action-by-action so that when a later action
      // fails (or the user cancels) after an earlier tx already broadcast,
      // retrying resumes from the first incomplete action instead of
      // re-broadcasting the completed ones. The record is intentionally kept
      // after success too: if the user somehow re-enters pay for the same
      // payment+option, all actions are treated as done rather than re-sent.
      // The key includes the signing account so results from one account are
      // never replayed into an attempt made with another.
      const progressKey = `${paymentId}:${optionId}:${
        indexedAccountId ?? accountId ?? ''
      }`;
      // stored progress transfers to this attempt only while every recorded
      // entry still matches the same-index action of the freshly fetched
      // list; the server may recompute actions between attempts (e.g. drop
      // an approve whose allowance is already satisfied), and replaying
      // results purely by position would then submit wrong data silently
      let storedProgress = completedActionsRef.current[progressKey] ?? [];
      if (
        storedProgress.some(
          (entry, index) =>
            !actions[index] ||
            entry.fingerprint !== getWcPayActionFingerprint(actions[index]),
        )
      ) {
        storedProgress = [];
        delete completedActionsRef.current[progressKey];
      }
      const signatures = await executeActions({
        actions,
        accountId,
        indexedAccountId,
        completedResults: storedProgress.map((entry) => entry.result),
        onActionComplete: ({ index, result: actionResult }) => {
          const progress = completedActionsRef.current[progressKey] ?? [];
          progress[index] = {
            fingerprint: getWcPayActionFingerprint(actions[index]),
            result: actionResult,
          };
          completedActionsRef.current[progressKey] = progress;
        },
      });

      // 4. submit and show result. The transaction may already be broadcast
      // by this point, so a confirmPayment failure must NOT drop the
      // signatures back on the options page (retrying there would sign and
      // broadcast a second payment). Hand the same signatures to the result
      // page, whose polling keeps re-submitting confirmPayment.
      let confirmResult: IWcPayConfirmResult;
      try {
        confirmResult =
          await backgroundApiProxy.serviceWalletConnectPay.confirmPayment({
            paymentId,
            optionId,
            signatures,
          });
      } catch {
        confirmResult = { status: EWcPayStatus.Processing, isFinal: false };
      }
      navigation.push(EModalWalletConnectPayRoutes.PaymentResult, {
        paymentId,
        optionId,
        signatures,
        initialResult: confirmResult,
      });
    } catch (error) {
      // user-intent cancellation (dismissed a confirm modal or the collect
      // form) ends the flow silently
      if (!(error instanceof WcPayUserCancelledError)) {
        Toast.error({
          title:
            (error as Error | undefined)?.message ??
            intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }
    } finally {
      setIsPaying(false);
    }
  }, [
    payResult,
    selectedOption,
    isPaying,
    isLoading,
    isPaymentActionable,
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
        {!isLoading && loadError ? (
          <Stack
            flex={1}
            alignItems="center"
            justifyContent="center"
            py="$10"
            gap="$3"
          >
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              })}
            </SizableText>
            <Button
              testID="wc-pay-options-retry"
              size="small"
              onPress={() => {
                void run();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </Stack>
        ) : null}
        {!loadError && (isLoading || !payResult) ? (
          <Stack flex={1} alignItems="center" justifyContent="center" py="$10">
            <Spinner size="large" />
          </Stack>
        ) : null}
        {!loadError && !isLoading && payResult ? (
          <YStack px="$5" gap="$4">
            <YStack alignItems="center" gap="$1" py="$4">
              <SizableText size="$headingXl">
                {payResult.info?.merchant?.name ?? ''}
              </SizableText>
              {payResult.info?.amount ? (
                <SizableText size="$heading3xl">
                  {formatPayAmount({
                    value: payResult.info.amount.value,
                    decimals: payResult.info.amount.display.decimals,
                    symbol: payResult.info.amount.display.assetSymbol,
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
              {options.map((option) => {
                const { display } = option.amount;
                const networkId = getWcPayOptionNetworkId(option);
                const network = networkId ? networkMap?.[networkId] : undefined;
                const networkName = network?.name ?? display.networkName;
                // native-coin options often ship without iconUrl; the local
                // network logo is the canonical icon for them
                const tokenImageUri = display.iconUrl || network?.logoURI;
                const networkImageUri =
                  network?.logoURI ?? display.networkIconUrl;
                return (
                  <ListItem
                    key={option.id}
                    userSelect="none"
                    checkMark={selectedOption?.id === option.id}
                    onPress={() => setSelectedOptionId(option.id)}
                  >
                    <Token
                      size="lg"
                      tokenImageUri={tokenImageUri}
                      networkImageUri={networkImageUri}
                    />
                    <ListItem.Text
                      flex={1}
                      primary={
                        <XStack alignItems="center" gap="$1" minWidth={0}>
                          <SizableText
                            size="$bodyLgMedium"
                            numberOfLines={1}
                            flexShrink={1}
                          >
                            {display.assetSymbol}
                          </SizableText>
                          {networkName ? (
                            <Badge flexShrink={1}>
                              <Badge.Text numberOfLines={1}>
                                {networkName}
                              </Badge.Text>
                            </Badge>
                          ) : null}
                        </XStack>
                      }
                      secondary={display.assetName}
                    />
                    <ListItem.Text
                      align="right"
                      primary={
                        <NumberSizeableText
                          textAlign="right"
                          size="$bodyLgMedium"
                          formatter="balance"
                          formatterOptions={{
                            tokenSymbol: display.assetSymbol,
                          }}
                        >
                          {new BigNumber(option.amount.value)
                            .shiftedBy(-display.decimals)
                            .toFixed()}
                        </NumberSizeableText>
                      }
                    />
                  </ListItem>
                );
              })}
              {options.length === 0 ? (
                <Stack alignItems="center" py="$8" gap="$1">
                  <SizableText size="$bodyLgMedium">
                    {/* copy pending product i18n keys */}
                    {isPaymentInactive
                      ? 'Payment unavailable'
                      : 'No payment options available'}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {isPaymentInactive
                      ? `This payment is ${payStatus ?? 'closed'} and can no longer be paid.`
                      : 'No supported asset has enough balance to cover this payment. Top up a supported stablecoin (plus gas) and try again.'}
                  </SizableText>
                </Stack>
              ) : null}
            </YStack>
          </YStack>
        ) : null}
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          void handlePay();
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          disabled:
            !isPaymentActionable || !selectedOption || isPaying || !!isLoading,
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
