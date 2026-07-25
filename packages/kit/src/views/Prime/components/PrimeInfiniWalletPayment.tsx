/* cspell:ignore Infini */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  getFontVariantStyle,
  usePreventRemove,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { useSpecifiedTokenSelectorBalances } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms';
import {
  usePrimePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getListedNetworkMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  buildPrimeInfiniPaymentCacheKey,
  createPrimeInfiniPaymentBindingId,
  isPrimeInfiniPaymentCacheKeyForContext,
  isSamePrimeInfiniPaymentCacheKey,
  isSamePrimeInfiniPaymentTransferSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPrimeInfiniPendingPaymentSession as IPersistedPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPayment,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import {
  resolvePrimeInfiniPaymentDisplaySnapshot,
  shouldShowPrimeInfiniExternalCheckoutLink,
  shouldShowPrimeInfiniPaymentButtonSkeleton,
} from '../hooks/primeInfiniPaymentDisplaySnapshot';
import {
  addPrimeInfiniDiscardedPaymentBindingId,
  getPrimeInfiniAccountSelectionIdentity,
  getPrimeInfiniConfirmedAccountSelectionOutcome,
  resolvePrimeInfiniPaymentAccountRebind,
  resolvePrimeInfiniPaymentForcedReplacement,
  resolvePrimeInfiniPaymentReplacement,
  shouldRebindPrimeInfiniPaymentForAccount,
} from '../hooks/primeInfiniPaymentReplacement';
import { resolvePrimeInfiniPaymentRestore } from '../hooks/primeInfiniPaymentRestore';
import { startPrimeInfiniPaymentSendExitRecovery } from '../hooks/primeInfiniPaymentSendExitRecovery';
import { createPrimeInfiniPaymentSessionQueue } from '../hooks/primeInfiniPaymentSessionQueue';
import {
  buildPrimeInfiniPaymentTransferIntent,
  canChangePrimeInfiniPaymentSelection,
  getCanonicalPrimeInfiniPaymentAsset,
  getPrimeInfiniPaymentAssets,
  getPrimeInfiniPaymentCountdown,
  getPrimeInfiniPaymentErrorRecoveryPhase,
  getPrimeInfiniPaymentOutcome,
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniBalanceSufficient,
  isPrimeInfiniPaymentForAsset,
  isPrimeInfiniPaymentReplaceable,
  isPrimeInfiniPaymentWithinSendSafetyWindow,
  shouldBlockPrimeInfiniPaymentRefresh,
  shouldRenderPrimeInfiniPaymentSelection,
} from '../hooks/primeInfiniPaymentUtils';
import { usePrimeInfiniPaymentPolling } from '../hooks/usePrimeInfiniPaymentPolling';
import {
  isPrimeInfiniExternalCheckoutInFlight,
  usePrimeInfiniPurchase,
} from '../hooks/usePrimeInfiniPurchase';
import { logPrimeInfiniPaymentFlow } from '../primeInfiniPaymentLogger';
import { PRIME_PAY_WITH_CRYPTO_LABEL } from '../primePaymentLabels';
import { ensurePrimePurchaseEligible } from '../primePurchaseEligibility';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../primeSubscriptionPurchaseSuccess';

import type {
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentPhase,
  IPrimeInfiniPurchaseBaseline,
} from '../hooks/primeInfiniPaymentUtils';
import type { ISubscriptionPeriod } from '../hooks/usePrimePaymentTypes';

const ACCOUNT_SELECTOR_ENABLED_NUM = [0];
const MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS = 30_000;
const PRIME_PAYMENT_MODAL_CLOSE_DELAY_MS = 300;
const PRIME_PAYMENT_BUTTON_NUMERIC_STYLE = getFontVariantStyle([
  'tabular-nums',
]);

function getPrimeInfiniPaymentLogContext({
  payment,
  asset,
}: {
  payment?: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
}) {
  return {
    paymentId: payment?.paymentId,
    networkId: asset.networkId,
    tokenSymbol: asset.token,
    amountDue: payment?.amountDue,
  };
}

type ILoadPaymentOptionsState = {
  assets: IPrimeInfiniPaymentAsset[];
  baseline: IPrimeInfiniPurchaseBaseline;
  hasError: boolean;
  canUseExternalCheckout: boolean;
  shouldCreatePayment: boolean;
  shouldShowExistingPaymentChoice: boolean;
  pendingSession?: IPrimeInfiniPendingPaymentSession;
  completedPaymentId?: string;
};

type IPrimeInfiniPendingPaymentSession = Omit<
  IPersistedPrimeInfiniPendingPaymentSession,
  'featureName'
> & {
  featureName?: EPrimeFeatures;
};

type IPaymentPhase = IPrimeInfiniPaymentPhase;

type IPrimeInfiniPaymentSelectionSnapshot = {
  accountDisplayName: string;
  activeAccount: IAccountSelectorActiveAccountInfo;
  asset: IPrimeInfiniPaymentAsset;
  balanceDetail?: IFetchTokenDetailItem;
};

type IConfirmAccountSelectedPayload = {
  num: number;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
};

type IPayWithExternalWallet = (params: {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
  beforeCheckout?: () => Promise<boolean>;
  beforeOpenCheckout?: () => Promise<void>;
}) => Promise<boolean>;

type ICloseExternalCheckoutConfirmation = () => void | Promise<void>;

type IPrimeInfiniPaymentFooterProps = {
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  showConfirmButtonSkeleton?: boolean;
  onCancelText?: string;
  onConfirmText?: string;
  onConfirmContent?: ReactNode;
  cancelButtonProps?: {
    disabled?: boolean;
  };
  confirmButtonProps?: {
    disabled?: boolean;
    loading?: boolean;
  };
  onConfirm?: () => void | Promise<void>;
  afterActionsContent?: ReactNode;
};

type IPrimeInfiniExternalCheckoutLinkProps = {
  testID: string;
  disabled: boolean;
  loading?: boolean;
  onPress: () => void | Promise<void>;
};

const PRIME_FEATURE_VALUES = new Set<string>(Object.values(EPrimeFeatures));

function PrimeInfiniExternalCheckoutLink({
  testID,
  disabled,
  loading,
  onPress,
}: IPrimeInfiniExternalCheckoutLinkProps) {
  return (
    <XStack justifyContent="center" $gtMd={{ justifyContent: 'flex-start' }}>
      <Button
        testID={testID}
        size="small"
        variant="link"
        px="$0"
        childrenAsText={false}
        disabled={disabled}
        loading={loading}
        onPress={onPress}
      >
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {/* TODO: i18n pending translation key */}
            Pay with an external wallet
          </SizableText>
          <Icon name="ArrowTopRightOutline" size="$3.5" color="$iconSubdued" />
        </XStack>
      </Button>
    </XStack>
  );
}

function PrimeInfiniPaymentFooter({
  showCancelButton = false,
  showConfirmButton = true,
  showConfirmButtonSkeleton = false,
  onCancelText,
  onConfirmText,
  onConfirmContent,
  cancelButtonProps,
  confirmButtonProps,
  onConfirm,
  afterActionsContent,
}: IPrimeInfiniPaymentFooterProps) {
  const [confirmButtonMinWidth, setConfirmButtonMinWidth] = useState<number>();
  const handleConfirm = useCallback(() => {
    void Promise.resolve(onConfirm?.()).catch((error) => {
      errorToastUtils.showToastOfError(error);
    });
  }, [onConfirm]);
  let confirmButton: ReactElement | undefined;
  if (showConfirmButton && showConfirmButtonSkeleton) {
    confirmButton = (
      <PrimeInfiniPaymentConfirmButtonSkeleton testID="prime-infini-payment-quote-skeleton" />
    );
  } else if (showConfirmButton && onConfirmContent) {
    confirmButton = (
      <Page.ConfirmButton
        {...confirmButtonProps}
        childrenAsText={false}
        minWidth={confirmButtonMinWidth}
        onLayout={(event) => {
          const width = Math.ceil(event.nativeEvent.layout.width);
          setConfirmButtonMinWidth((currentWidth) =>
            currentWidth === undefined || width > currentWidth
              ? width
              : currentWidth,
          );
        }}
        onConfirm={handleConfirm}
      >
        {onConfirmContent}
      </Page.ConfirmButton>
    );
  }

  // Page.Footer registers these controls in the modal's native footer slot.
  return (
    <Page.Footer>
      <YStack p="$5" bg="$bgApp">
        <Page.FooterActions
          p="$0"
          gap="$2"
          flexDirection="column-reverse"
          $gtMd={{ flexDirection: 'row', alignItems: 'center' }}
          onCancelText={onCancelText}
          onConfirmText={onConfirmText}
          cancelButtonProps={
            showCancelButton ? (cancelButtonProps ?? {}) : undefined
          }
          confirmButtonProps={
            showConfirmButton && !confirmButton
              ? (confirmButtonProps ?? {})
              : undefined
          }
          confirmButton={confirmButton}
          onConfirm={
            showConfirmButton && !confirmButton ? handleConfirm : undefined
          }
        >
          {afterActionsContent}
        </Page.FooterActions>
      </YStack>
    </Page.Footer>
  );
}

function PrimeInfiniPaymentConfirmButtonSkeleton({
  testID,
}: {
  testID?: string;
}) {
  return (
    <Stack testID={testID} w="100%" $gtMd={{ w: '$40' }}>
      <Skeleton h="$10" w="100%" borderRadius="$full" />
    </Stack>
  );
}

function PrimeInfiniPaymentSkeleton() {
  return (
    <>
      <YStack gap="$4">
        <YStack gap="$2">
          <Skeleton h="$4" w="$16" borderRadius="$1" />
          <Skeleton h="$14" w="100%" borderRadius="$3" />
        </YStack>
        <YStack gap="$2">
          <Skeleton h="$4" w="$20" borderRadius="$1" />
          <Skeleton h="$14" w="100%" borderRadius="$3" />
        </YStack>
      </YStack>
      <Page.Footer>
        <XStack
          px="$5"
          py="$5"
          justifyContent="center"
          $gtMd={{ justifyContent: 'flex-end' }}
        >
          <PrimeInfiniPaymentConfirmButtonSkeleton />
        </XStack>
      </Page.Footer>
    </>
  );
}

function PrimeInfiniPaymentCompletionStatus({
  hasError = false,
  onRetry,
}: {
  hasError?: boolean;
  onRetry?: () => void;
}) {
  const intl = useIntl();
  return (
    <>
      <YStack
        testID="prime-infini-payment-completion"
        flex={1}
        minHeight="$48"
        gap="$4"
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          w="$16"
          h="$16"
          borderRadius="$full"
          bg="$bgSuccessSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="CheckRadioSolid" size="$10" color="$iconSuccess" />
        </Stack>
        <YStack gap="$2" alignItems="center">
          <SizableText size="$headingMd" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.prime_payment_successful,
            })}
          </SizableText>
          {hasError ? (
            <Alert
              testID="prime-infini-payment-completion-error"
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.global_failed,
              })}
            />
          ) : (
            <XStack gap="$2" alignItems="center">
              <Spinner size="small" />
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {intl.formatMessage({ id: ETranslations.global_processing })}
              </SizableText>
            </XStack>
          )}
        </YStack>
      </YStack>
      <PrimeInfiniPaymentFooter
        showCancelButton={false}
        showConfirmButton={hasError}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_retry,
        })}
        onConfirm={onRetry}
      />
    </>
  );
}

function PrimeInfiniPaymentUnavailableSelection({
  errorTitle,
  isRetrying,
  onRetry,
  afterActionsContent,
}: {
  errorTitle: string;
  isRetrying: boolean;
  onRetry: () => Promise<void>;
  afterActionsContent?: ReactNode;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_account })}
        </SizableText>
        <ListItem
          testID="prime-infini-account-selector"
          mx="$0"
          minHeight="$14"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          title={intl.formatMessage({
            id: ETranslations.global_select_wallet,
          })}
          icon="WalletOutline"
          disabled
        >
          <PrimeInfiniSelectorChevron />
        </ListItem>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
        <ListItem
          testID="prime-infini-asset-selector-trigger"
          mx="$0"
          minHeight="$14"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          title={intl.formatMessage({
            id: ETranslations.swap_page_button_select_token,
          })}
          disabled
        >
          <PrimeInfiniSelectorChevron />
        </ListItem>
      </YStack>
      <Alert type="critical" title={errorTitle} />
      <PrimeInfiniPaymentFooter
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_retry,
        })}
        confirmButtonProps={{
          disabled: isRetrying,
          loading: isRetrying,
        }}
        onConfirm={onRetry}
        afterActionsContent={afterActionsContent}
      />
    </YStack>
  );
}

function PrimeInfiniExistingPaymentChoice({
  session,
  isStartingNewPayment,
  onContinueExistingPayment,
  onStartNewPayment,
}: {
  session: IPrimeInfiniPendingPaymentSession;
  isStartingNewPayment: boolean;
  onContinueExistingPayment: () => void;
  onStartNewPayment: () => Promise<void>;
}) {
  const handleStartNewPayment = useCallback(() => {
    void onStartNewPayment().catch((error) => {
      errorToastUtils.showToastOfError(error);
    });
  }, [onStartNewPayment]);

  return (
    <>
      <YStack gap="$4">
        <Alert
          type="warning"
          // TODO: i18n pending translation key
          title="Unfinished payment found"
          // TODO: i18n pending translation key
          description="The previous transfer may still complete. Starting a new payment could result in duplicate transfers."
        />
        <YStack
          gap="$3"
          p="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
        >
          <XStack justifyContent="space-between" gap="$3">
            {/* TODO: i18n pending translation key */}
            <SizableText color="$textSubdued">Payment amount</SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountDue} {session.payment.token}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" gap="$3">
            {/* TODO: i18n pending translation key */}
            <SizableText color="$textSubdued">Confirmed</SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountConfirmed ?? '0'} {session.payment.token}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" gap="$3">
            {/* TODO: i18n pending translation key */}
            <SizableText color="$textSubdued">Confirming</SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountConfirming ?? '0'} {session.payment.token}
            </SizableText>
          </XStack>
          {platformEnv.isDev ? (
            <YStack gap="$1">
              <SizableText color="$textSubdued">Payment ID</SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                userSelect="text"
              >
                {session.payment.paymentId}
              </SizableText>
            </YStack>
          ) : null}
        </YStack>
      </YStack>
      <Page.Footer>
        <YStack gap="$2" px="$5" py="$5">
          <Button
            testID="prime-infini-continue-existing-payment"
            variant="secondary"
            disabled={isStartingNewPayment}
            onPress={onContinueExistingPayment}
          >
            {/* TODO: i18n pending translation key */}
            Keep waiting for this payment
          </Button>
          <Button
            testID="prime-infini-start-new-payment"
            variant="primary"
            loading={isStartingNewPayment}
            disabled={isStartingNewPayment}
            onPress={handleStartNewPayment}
          >
            {/* TODO: i18n pending translation key */}
            Start a new payment anyway
          </Button>
        </YStack>
      </Page.Footer>
    </>
  );
}

function PrimeInfiniSelectorChevron() {
  return <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />;
}

function usePrimeInfiniPaymentExpiryCountdown({
  expiresAt,
  onStateChange,
}: {
  expiresAt: number | undefined;
  onStateChange: (state: {
    expiresAt: number;
    isExpired: boolean;
    isWithinSendSafetyWindow: boolean;
  }) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const countdown = expiresAt
    ? getPrimeInfiniPaymentCountdown({ expiresAt, now })
    : undefined;
  const countdownIsExpired = countdown?.isExpired;
  const countdownRemainingSeconds = countdown?.remainingSeconds;

  useEffect(() => {
    if (!expiresAt) {
      return undefined;
    }
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (
      !expiresAt ||
      countdownIsExpired === undefined ||
      countdownRemainingSeconds === undefined
    ) {
      return;
    }
    onStateChange({
      expiresAt,
      isExpired: countdownIsExpired,
      isWithinSendSafetyWindow:
        countdownRemainingSeconds * 1000 <= MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS,
    });
  }, [countdownIsExpired, countdownRemainingSeconds, expiresAt, onStateChange]);

  return countdown?.formatted;
}

function normalizePendingPaymentSession(
  session: IPersistedPrimeInfiniPendingPaymentSession | undefined,
): IPrimeInfiniPendingPaymentSession | undefined {
  if (!session) {
    return undefined;
  }
  return {
    ...session,
    featureName:
      session.featureName && PRIME_FEATURE_VALUES.has(session.featureName)
        ? (session.featureName as EPrimeFeatures)
        : undefined,
  };
}

function getInitialPaymentPhase(
  session: IPrimeInfiniPendingPaymentSession | undefined,
): IPaymentPhase {
  if (!session) {
    return 'selecting';
  }
  const outcome = getPrimeInfiniPaymentOutcome({ payment: session.payment });
  if (
    session.sendStarted ||
    outcome === 'confirmed' ||
    hasPrimeInfiniPaymentProgress(session.payment)
  ) {
    return 'polling';
  }
  if (outcome === 'expired' || outcome === 'failed') {
    return outcome;
  }
  if (
    isPrimeInfiniPaymentWithinSendSafetyWindow({
      payment: session.payment,
      minValidityBeforeSendMs: MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS,
    })
  ) {
    return 'expired';
  }
  return 'selecting';
}

function isTokenAddressMatched({
  networkId,
  expected,
  actual,
}: {
  networkId: string;
  expected: string;
  actual: string;
}) {
  return networkId.startsWith('evm--')
    ? expected.toLowerCase() === actual.toLowerCase()
    : expected === actual;
}

function PrimeInfiniWalletPaymentContent({
  plan,
  selectedSubscriptionPeriod,
  featureName,
  assets,
  selectedAsset,
  baseline,
  pendingSession,
  onSelectedAssetChange,
  onDiscardPaymentSession,
  onReplacePaymentSession,
  onReloadPaymentSession,
  onRestartPaymentSession,
  onPayWithExternalWallet,
  onClose,
  onExitPreventedChange,
  initialAccountSyncPromiseRef,
  isOptionsRefreshing,
  shouldCreatePayment,
  paymentContextErrorTitle,
  isPaymentContextRetrying,
  onRetryPaymentContext,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
  assets: IPrimeInfiniPaymentAsset[];
  selectedAsset: IPrimeInfiniPaymentAsset;
  baseline: IPrimeInfiniPurchaseBaseline;
  pendingSession?: IPrimeInfiniPendingPaymentSession;
  onSelectedAssetChange: (assetKey: string) => void;
  onDiscardPaymentSession: (bindingId: string) => void;
  onReplacePaymentSession: ({
    bindingId,
    assetKey,
  }: {
    bindingId: string;
    assetKey: string;
  }) => void;
  onReloadPaymentSession: () => void;
  onRestartPaymentSession: () => void;
  onPayWithExternalWallet: IPayWithExternalWallet;
  onClose: () => void;
  onExitPreventedChange: (isPrevented: boolean) => void;
  initialAccountSyncPromiseRef: {
    current: Promise<void> | undefined;
  };
  isOptionsRefreshing: boolean;
  shouldCreatePayment: boolean;
  paymentContextErrorTitle?: string;
  isPaymentContextRetrying: boolean;
  onRetryPaymentContext: () => Promise<void>;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation<IPageNavigationProp<IPrimeParamList>>();
  const { user, isLoggedIn, isReady: isAuthReady } = useOneKeyAuth();
  const actions = useAccountSelectorActions();
  const { activeAccount, showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    linkNetwork: true,
    linkNetworkId: selectedAsset.networkId,
  });
  const account = activeAccount.account;
  const accountId = account?.id;
  const accountAddress = account?.address;
  const isOwnAccount = Boolean(
    accountId && accountUtils.isOwnAccount({ accountId }),
  );
  const isSelectedNetworkReady =
    activeAccount.ready &&
    activeAccount.network?.id === selectedAsset.networkId &&
    !activeAccount.isNetworkNotMatched;
  const isPurchaseUserCurrent = Boolean(
    isAuthReady &&
    isLoggedIn &&
    baseline.onekeyUserId &&
    user?.onekeyUserId === baseline.onekeyUserId,
  );
  const signatureConfirm = useSignatureConfirm({
    accountId: accountId ?? '',
    networkId: selectedAsset.networkId,
  });

  const [phase, setPhase] = useState<IPaymentPhase>(() =>
    getInitialPaymentPhase(pendingSession),
  );
  const [payment, setPayment] = useState<IPrimeInfiniPayment | undefined>(
    pendingSession?.payment,
  );
  const [isPaymentWithinSendSafetyWindow, setIsPaymentWithinSendSafetyWindow] =
    useState(false);
  const [sendStarted, setSendStarted] = useState(
    pendingSession?.sendStarted ?? false,
  );
  const [accountSyncFailed, setAccountSyncFailed] = useState(false);
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const paymentRef = useRef(payment);
  paymentRef.current = payment;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const sendStartedRef = useRef(sendStarted);
  sendStartedRef.current = sendStarted;
  const paymentAccountIdRef = useRef(pendingSession?.payerAccountId);
  const paymentAccountAddressRef = useRef(pendingSession?.payerAddress);
  const paymentCacheKeyRef = useRef(pendingSession?.paymentCacheKey);
  const paymentAssetRef = useRef(pendingSession?.asset ?? selectedAsset);
  const [paymentBindingId] = useState(
    () =>
      pendingSession?.paymentCacheKey.bindingId ??
      createPrimeInfiniPaymentBindingId(),
  );
  const submitInFlightRef = useRef(false);
  const successHandledRef = useRef(false);
  const sessionPersistenceQueueRef = useRef(
    createPrimeInfiniPaymentSessionQueue(),
  );
  const mountedRef = useRef(true);
  const asyncAttemptGenerationRef = useRef(0);
  const isPurchaseUserCurrentRef = useRef(isPurchaseUserCurrent);
  isPurchaseUserCurrentRef.current = isPurchaseUserCurrent;
  const accountSyncGenerationRef = useRef(0);
  const accountSelectorOpenRef = useRef(false);
  const accountSelectorInitialIdentityRef = useRef('');
  const replacementTargetAssetKeyRef = useRef('');
  const replacementSourceAssetRef = useRef<
    IPrimeInfiniPaymentAsset | undefined
  >(undefined);

  const selectionIdentity =
    accountId && accountAddress && isSelectedNetworkReady
      ? `${accountId}:${accountAddress}:${selectedAsset.networkId}:${selectedAsset.contractAddress}`
      : '';
  const selectionIdentityRef = useRef(selectionIdentity);
  selectionIdentityRef.current = selectionIdentity;
  const selectedBalanceTargets = useMemo(
    () => [
      {
        key: selectedAsset.key,
        networkId: selectedAsset.networkId,
        contractAddress: selectedAsset.contractAddress,
      },
    ],
    [selectedAsset.contractAddress, selectedAsset.key, selectedAsset.networkId],
  );
  const {
    balanceStateByKey,
    isComplete: isBalanceComplete,
    isLoading: isBalanceLoading,
    refresh: refreshTokenBalances,
  } = useSpecifiedTokenSelectorBalances({
    accountId,
    networkId: selectedAsset.networkId,
    indexedAccountId: activeAccount.indexedAccount?.id,
    targets: selectedBalanceTargets,
    enabled: Boolean(selectionIdentity && isOwnAccount),
  });

  const persistPaymentSession = useCallback(
    async ({
      nextPayment,
      nextSendStarted = sendStartedRef.current,
      nextPayerAccountId = paymentAccountIdRef.current,
      nextPayerAddress = paymentAccountAddressRef.current,
      nextAsset = paymentAssetRef.current,
    }: {
      nextPayment: IPrimeInfiniPayment;
      nextSendStarted?: boolean;
      nextPayerAccountId?: string;
      nextPayerAddress?: string;
      nextAsset?: IPrimeInfiniPaymentAsset;
    }): Promise<IPrimeInfiniPendingPaymentSession> => {
      const onekeyUserId = baseline.onekeyUserId;
      if (!onekeyUserId || !nextPayerAccountId || !nextPayerAddress) {
        throw new OneKeyLocalError(
          'Infini payment cache identity is incomplete',
        );
      }
      const paymentCacheKey = buildPrimeInfiniPaymentCacheKey({
        bindingId: paymentBindingId,
        payment: nextPayment,
        asset: nextAsset,
        onekeyUserId,
        plan,
        payerAccountId: nextPayerAccountId,
        payerAddress: nextPayerAddress,
      });
      const persistedSession = await sessionPersistenceQueueRef.current.persist(
        async () => {
          const storedSession =
            await backgroundApiProxy.simpleDb.prime.setInfiniPendingPaymentSession(
              {
                onekeyUserId,
                session: {
                  asset: nextAsset,
                  baseline: {
                    ...baseline,
                    onekeyUserId,
                  },
                  plan,
                  selectedSubscriptionPeriod,
                  featureName,
                  payerAccountId: nextPayerAccountId,
                  payerAddress: nextPayerAddress,
                  paymentCacheKey,
                  payment: nextPayment,
                  sendStarted: nextSendStarted,
                },
              },
            );
          paymentCacheKeyRef.current = storedSession.paymentCacheKey;
          paymentAssetRef.current = storedSession.asset;
          return storedSession;
        },
      );
      if (!persistedSession) {
        throw new OneKeyLocalError(
          'Infini payment session persistence was finalized',
        );
      }
      const normalizedSession =
        normalizePendingPaymentSession(persistedSession);
      if (!normalizedSession) {
        throw new OneKeyLocalError(
          'Infini payment session persistence returned invalid data',
        );
      }
      return normalizedSession;
    },
    [baseline, featureName, paymentBindingId, plan, selectedSubscriptionPeriod],
  );

  const clearPaymentSession = useCallback(
    async (expectedPaymentId?: string) => {
      const onekeyUserId = baseline.onekeyUserId;
      const expectedPaymentCacheIdentity = paymentCacheKeyRef.current;
      if (
        onekeyUserId &&
        (!expectedPaymentId ||
          expectedPaymentCacheIdentity?.paymentId === expectedPaymentId)
      ) {
        await sessionPersistenceQueueRef.current.finalize(() =>
          backgroundApiProxy.simpleDb.prime.clearInfiniPendingPaymentSession({
            onekeyUserId,
            expectedPaymentCacheIdentity,
          }),
        );
      }
    },
    [baseline.onekeyUserId],
  );

  const discardPaymentSessionForSelectionChange = useCallback(
    async (expectedPaymentId: string) => {
      const onekeyUserId = baseline.onekeyUserId;
      const expectedPaymentCacheIdentity = paymentCacheKeyRef.current;
      if (
        !onekeyUserId ||
        expectedPaymentCacheIdentity?.paymentId !== expectedPaymentId
      ) {
        throw new OneKeyLocalError(
          'Infini payment cache identity is unavailable',
        );
      }
      let wasDiscardRejected = false;
      try {
        await sessionPersistenceQueueRef.current.finalize(async () => {
          const didDiscard =
            await backgroundApiProxy.simpleDb.prime.discardUnsentInfiniPendingPaymentSession(
              {
                onekeyUserId,
                expectedPaymentCacheIdentity,
              },
            );
          if (!didDiscard) {
            wasDiscardRejected = true;
            throw new OneKeyLocalError(
              'Infini payment session cannot be replaced',
            );
          }
        });
        return true;
      } catch (error) {
        if (wasDiscardRejected) {
          return false;
        }
        throw error;
      }
    },
    [baseline.onekeyUserId],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      asyncAttemptGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const generation = accountSyncGenerationRef.current + 1;
    accountSyncGenerationRef.current = generation;
    setAccountSyncFailed(false);
    setAccountSyncReady(false);
    void (async () => {
      if (initialAccountSyncPromiseRef.current === undefined) {
        initialAccountSyncPromiseRef.current = actions.current.syncFromScene({
          from: {
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
            sceneNum: 0,
          },
          num: 0,
          availableNetworks: {
            networkIds: [selectedAsset.networkId],
            defaultNetworkId: selectedAsset.networkId,
          },
        });
      }
      await initialAccountSyncPromiseRef.current;
      if (accountSyncGenerationRef.current !== generation) {
        return;
      }
      await actions.current.updateSelectedAccountNetwork({
        num: 0,
        networkId: selectedAsset.networkId,
      });
      if (accountSyncGenerationRef.current === generation) {
        setAccountSyncReady(true);
      }
    })().catch(() => {
      if (accountSyncGenerationRef.current === generation) {
        initialAccountSyncPromiseRef.current = undefined;
        setAccountSyncReady(false);
        setAccountSyncFailed(true);
      }
    });
    return () => {
      if (accountSyncGenerationRef.current === generation) {
        accountSyncGenerationRef.current += 1;
      }
    };
  }, [actions, initialAccountSyncPromiseRef, selectedAsset.networkId]);

  useEffect(() => {
    if (payment && isAuthReady && !isPurchaseUserCurrent) {
      asyncAttemptGenerationRef.current += 1;
      submitInFlightRef.current = false;
      setPhase('failed');
    }
  }, [isAuthReady, isPurchaseUserCurrent, payment]);

  const handlePurchaseSuccess = useCallback(
    async (latestPayment: IPrimeInfiniPayment) => {
      const purchaseUserId = baseline.onekeyUserId;
      if (
        successHandledRef.current ||
        !mountedRef.current ||
        !isPurchaseUserCurrentRef.current ||
        !purchaseUserId
      ) {
        return;
      }
      successHandledRef.current = true;
      onExitPreventedChange(true);
      setPhase('finalizing');
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: latestPayment,
          asset: selectedAsset,
        }),
        sendStarted: true,
      });
      try {
        const successPayload =
          await preparePrimeSubscriptionPurchaseSuccess(purchaseUserId);
        await clearPaymentSession(latestPayment.paymentId);
        const analyticsAmount = Number(latestPayment.amountDue);
        defaultLogger.prime.subscription.primeSubscribeSuccess({
          planType: plan,
          amount: Number.isFinite(analyticsAmount) ? analyticsAmount : 0,
          currency: 'USD',
          featureName,
          paymentMethod: 'crypto',
        });
        if (mountedRef.current && isPurchaseUserCurrentRef.current) {
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.prime_payment_successful,
            }),
            message: intl.formatMessage({
              id: ETranslations.prime_payment_successful_description,
            }),
          });
        }
        if (mountedRef.current) {
          onClose();
        }
        logPrimeInfiniPaymentFlow({
          stage: 'purchaseCompletion',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: latestPayment,
            asset: selectedAsset,
          }),
          sendStarted: true,
        });
        void (async () => {
          await timerUtils.wait(350);
          await finishPrimeSubscriptionPurchaseSuccess(successPayload);
        })().catch((error) => {
          errorToastUtils.showToastOfError(error);
        });
      } catch (error) {
        successHandledRef.current = false;
        logPrimeInfiniPaymentFlow({
          stage: 'purchaseCompletion',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: latestPayment,
            asset: selectedAsset,
          }),
          sendStarted: true,
          error,
        });
        if (mountedRef.current) {
          onExitPreventedChange(false);
          setPhase(isPurchaseUserCurrentRef.current ? 'polling' : 'failed');
        }
        throw error;
      }
    },
    [
      baseline.onekeyUserId,
      clearPaymentSession,
      featureName,
      intl,
      onClose,
      onExitPreventedChange,
      plan,
      selectedAsset,
      selectedSubscriptionPeriod,
    ],
  );

  const handlePaymentTerminal = useCallback(
    (terminalOutcome: 'expired' | 'failed') => {
      submitInFlightRef.current = false;
      setPhase(terminalOutcome);
    },
    [],
  );

  const polling = usePrimeInfiniPaymentPolling({
    payment,
    asset: selectedAsset,
    baseline,
    enabled: phase === 'polling' && isPurchaseUserCurrent,
    onSuccess: handlePurchaseSuccess,
    onTerminal: handlePaymentTerminal,
  });

  useEffect(() => {
    if (polling.latestPayment) {
      void persistPaymentSession({
        nextPayment: polling.latestPayment,
      }).catch(() => undefined);
    }
  }, [persistPaymentSession, polling.latestPayment]);

  const listedNetworkMap = getListedNetworkMap();

  const selectedBalanceState = balanceStateByKey?.[selectedAsset.key];
  const balanceDetail = selectedBalanceState?.detail;
  const hasBalanceError = Boolean(
    selectionIdentity &&
    !isBalanceLoading &&
    (isBalanceComplete === false ||
      selectedBalanceState?.balanceLoaded === false ||
      (isBalanceComplete === true && !balanceDetail)),
  );
  const isBusy =
    phase === 'switching' ||
    phase === 'creating' ||
    phase === 'confirming' ||
    phase === 'finalizing';
  const shouldShowExternalCheckout = Boolean(
    !isBusy &&
    (!payment ||
      isPrimeInfiniPaymentReplaceable({
        payment,
        sendStarted,
      })),
  );
  useEffect(() => {
    onExitPreventedChange(isBusy);
  }, [isBusy, onExitPreventedChange]);
  useEffect(
    () => () => {
      onExitPreventedChange(false);
    },
    [onExitPreventedChange],
  );
  const canChangePaymentSelection = canChangePrimeInfiniPaymentSelection({
    phase,
    payment,
    sendStarted,
  });
  const isSelectionDataRefreshing = isOptionsRefreshing || isBalanceLoading;
  const canInteractWithPaymentSelection =
    canChangePaymentSelection && !isSelectionDataRefreshing;
  const canChangeAccountSelection =
    canInteractWithPaymentSelection && (accountSyncReady || accountSyncFailed);
  const isPaymentCacheContextCurrent = Boolean(
    payment &&
    paymentCacheKeyRef.current &&
    accountId &&
    accountAddress &&
    baseline.onekeyUserId &&
    isPrimeInfiniPaymentCacheKeyForContext({
      cacheKey: paymentCacheKeyRef.current,
      payment,
      asset: selectedAsset,
      onekeyUserId: baseline.onekeyUserId,
      plan,
      payerAccountId: accountId,
      payerAddress: accountAddress,
    }),
  );
  let accountDisplayName = intl.formatMessage({
    id: ETranslations.global_select_wallet,
  });
  if (account) {
    accountDisplayName = activeAccount.wallet?.name
      ? `${activeAccount.wallet.name} / ${account.name}`
      : account.name;
  }
  const {
    selectionSnapshot: displaySelectionSnapshot,
    payment: displayPayment,
  } = resolvePrimeInfiniPaymentDisplaySnapshot<
    IPrimeInfiniPaymentSelectionSnapshot,
    IPrimeInfiniPayment
  >({
    selectionSnapshot: {
      accountDisplayName,
      activeAccount,
      asset: selectedAsset,
      balanceDetail,
    },
    payment,
    isPaymentCurrent: isPaymentCacheContextCurrent,
  });
  const displayActiveAccount = displaySelectionSnapshot.activeAccount;
  const displayAccount = displayActiveAccount.account;
  const displayAccountAddress = displayAccount?.address;
  const displayAccountName = displaySelectionSnapshot.accountDisplayName;
  const displayAsset = displaySelectionSnapshot.asset;
  const displayBalanceDetail = displaySelectionSnapshot.balanceDetail;
  const isPaymentButtonPreparing = shouldShowPrimeInfiniPaymentButtonSkeleton({
    hasCurrentPayment: Boolean(displayPayment),
    isOptionsRefreshing,
    isBalanceLoading,
    accountSyncReady,
    accountSyncFailed,
  });
  const shouldRenderExternalCheckout =
    shouldShowPrimeInfiniExternalCheckoutLink({
      canUseExternalCheckout: shouldShowExternalCheckout,
      isPaymentButtonPreparing,
    });
  const canContinue = Boolean(
    phase === 'selecting' &&
    payment &&
    isPaymentCacheContextCurrent &&
    accountId &&
    accountAddress &&
    isOwnAccount &&
    isPurchaseUserCurrent &&
    accountSyncReady &&
    isSelectedNetworkReady &&
    paymentAccountIdRef.current === accountId &&
    balanceDetail &&
    payment.expiresAt > Date.now() + MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS &&
    !isPaymentWithinSendSafetyWindow &&
    !isOptionsRefreshing &&
    !isBalanceLoading &&
    !hasBalanceError,
  );
  const isCurrentBalanceInsufficient = Boolean(
    displayPayment &&
    balanceDetail &&
    !isPrimeInfiniBalanceSufficient({
      balance: balanceDetail.balanceParsed,
      amountDue: displayPayment.amountDue,
    }),
  );
  const handlePaymentExpiryStateChange = useCallback(
    ({
      expiresAt,
      isExpired,
      isWithinSendSafetyWindow,
    }: {
      expiresAt: number;
      isExpired: boolean;
      isWithinSendSafetyWindow: boolean;
    }) => {
      if (paymentRef.current?.expiresAt !== expiresAt) {
        return;
      }
      setIsPaymentWithinSendSafetyWindow(isWithinSendSafetyWindow);
      if (isExpired && phaseRef.current === 'selecting') {
        setPhase('expired');
      }
    },
    [],
  );
  const paymentExpiryCountdown = usePrimeInfiniPaymentExpiryCountdown({
    expiresAt: displayPayment?.expiresAt,
    onStateChange: handlePaymentExpiryStateChange,
  });
  const payButtonText = displayPayment
    ? `${intl.formatMessage({
        id: ETranslations.global_pay,
      })} ${displayPayment.amountDue} ${displayPayment.token}${
        paymentExpiryCountdown ? ` · ${paymentExpiryCountdown}` : ''
      }`
    : intl.formatMessage({
        id: ETranslations.global_pay,
      });

  useEffect(() => {
    if (accountSyncFailed && accountId && isSelectedNetworkReady) {
      initialAccountSyncPromiseRef.current ??= Promise.resolve();
      setAccountSyncFailed(false);
      setAccountSyncReady(true);
    }
  }, [
    accountId,
    accountSyncFailed,
    initialAccountSyncPromiseRef,
    isSelectedNetworkReady,
  ]);

  const replacePaymentForSelectionChange = useCallback(
    async (
      nextAssetKey: string,
      { isRetry = false }: { isRetry?: boolean } = {},
    ) => {
      const currentPayment = paymentRef.current;
      if (
        submitInFlightRef.current ||
        !isPurchaseUserCurrentRef.current ||
        !currentPayment ||
        !canChangePrimeInfiniPaymentSelection({
          phase,
          payment: currentPayment,
          sendStarted: sendStartedRef.current,
        })
      ) {
        return;
      }

      if (!isRetry && !replacementSourceAssetRef.current) {
        replacementSourceAssetRef.current =
          paymentAssetRef.current ?? selectedAsset;
      }
      const paymentAsset = replacementSourceAssetRef.current ?? selectedAsset;
      replacementTargetAssetKeyRef.current = nextAssetKey;
      submitInFlightRef.current = true;
      onExitPreventedChange(true);
      setPhase('switching');
      logPrimeInfiniPaymentFlow({
        stage: 'paymentReplacement',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentPayment,
          asset: paymentAsset,
        }),
        isRetry,
        reason: 'assetChanged',
        sendStarted: sendStartedRef.current,
      });
      const attemptGeneration = asyncAttemptGenerationRef.current + 1;
      asyncAttemptGenerationRef.current = attemptGeneration;
      const isAttemptOwned = () =>
        mountedRef.current &&
        asyncAttemptGenerationRef.current === attemptGeneration &&
        isPurchaseUserCurrentRef.current;
      const reloadCurrentSession = () => {
        replacementSourceAssetRef.current = undefined;
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          onReloadPaymentSession();
        }
      };

      try {
        const result = await resolvePrimeInfiniPaymentReplacement({
          currentPayment,
          selectedAsset: paymentAsset,
          sendStarted: sendStartedRef.current,
          fetchLatestPayment: (paymentId) =>
            backgroundApiProxy.servicePrime.apiGetInfiniPayment({
              paymentId,
              expectedOneKeyUserId: baseline.onekeyUserId ?? '',
            }),
          discardPaymentSession: discardPaymentSessionForSelectionChange,
          fetchPersistedPaymentSession: () =>
            backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
              onekeyUserId: baseline.onekeyUserId ?? '',
            }),
          persistTrackedPayment: (trackedPayment) =>
            persistPaymentSession({
              nextPayment: trackedPayment,
              nextSendStarted: true,
              nextAsset: paymentAsset,
            }),
          shouldContinue: isAttemptOwned,
        });

        if (result.type === 'cancelled') {
          logPrimeInfiniPaymentFlow({
            stage: 'paymentReplacement',
            status: 'cancelled',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: currentPayment,
              asset: paymentAsset,
            }),
            isRetry,
            reason: 'selectionAttemptStale',
            sendStarted: sendStartedRef.current,
          });
          replacementSourceAssetRef.current = undefined;
          submitInFlightRef.current = false;
          if (!mountedRef.current) {
            return;
          }
          if (!isPurchaseUserCurrentRef.current) {
            setPhase('failed');
          } else {
            onReloadPaymentSession();
          }
          return;
        }

        if (result.type === 'track') {
          logPrimeInfiniPaymentFlow({
            stage: 'paymentReplacement',
            status: 'blocked',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: result.payment,
              asset: paymentAsset,
            }),
            isRetry,
            reason: 'paymentProgressDetected',
            sendStarted: true,
          });
          if (!isAttemptOwned()) {
            reloadCurrentSession();
            return;
          }
          replacementTargetAssetKeyRef.current = '';
          replacementSourceAssetRef.current = undefined;
          paymentRef.current = result.payment;
          setPayment(result.payment);
          sendStartedRef.current = true;
          setSendStarted(true);
          submitInFlightRef.current = false;
          if (isAttemptOwned()) {
            setPhase('polling');
          } else if (mountedRef.current) {
            onReloadPaymentSession();
          }
          return;
        }

        if (result.type === 'reload') {
          logPrimeInfiniPaymentFlow({
            stage: 'paymentReplacement',
            status: 'recovered',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: currentPayment,
              asset: paymentAsset,
            }),
            isRetry,
            reason: 'sessionReloadRequired',
            sendStarted: sendStartedRef.current,
          });
          replacementTargetAssetKeyRef.current = '';
          replacementSourceAssetRef.current = undefined;
          reloadCurrentSession();
          return;
        }

        replacementTargetAssetKeyRef.current = '';
        replacementSourceAssetRef.current = undefined;
        submitInFlightRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        if (!isAttemptOwned()) {
          onReloadPaymentSession();
          return;
        }
        setPhase('selecting');
        const nextAsset =
          assets.find((asset) => asset.key === nextAssetKey) ?? paymentAsset;
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: nextAsset,
          }),
          isRetry,
          reason: 'preparedPaymentRetired',
          sendStarted: false,
        });
        onReplacePaymentSession({
          bindingId: paymentBindingId,
          assetKey: nextAssetKey,
        });
      } catch (error) {
        submitInFlightRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        if (!isAttemptOwned()) {
          onReloadPaymentSession();
          return;
        }
        setPhase('replacementFailed');
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: paymentAsset,
          }),
          isRetry,
          reason: 'assetReplacementFailed',
          sendStarted: sendStartedRef.current,
          error,
        });
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_network_error,
          }),
        });
      }
    },
    [
      baseline.onekeyUserId,
      assets,
      discardPaymentSessionForSelectionChange,
      featureName,
      intl,
      onExitPreventedChange,
      onReloadPaymentSession,
      onReplacePaymentSession,
      paymentBindingId,
      persistPaymentSession,
      phase,
      plan,
      selectedAsset,
      selectedSubscriptionPeriod,
    ],
  );

  const rebindPaymentForAccountChange = useCallback(async () => {
    const currentPayment = paymentRef.current;
    const currentPaymentCacheKey = paymentCacheKeyRef.current;
    if (
      submitInFlightRef.current ||
      !isPurchaseUserCurrentRef.current ||
      phase !== 'selecting' ||
      !currentPayment ||
      !currentPaymentCacheKey ||
      !accountId ||
      !accountAddress ||
      !isPrimeInfiniPaymentReplaceable({
        payment: currentPayment,
        sendStarted: sendStartedRef.current,
      })
    ) {
      return;
    }

    replacementTargetAssetKeyRef.current = '';
    submitInFlightRef.current = true;
    onExitPreventedChange(true);
    setPhase('switching');
    logPrimeInfiniPaymentFlow({
      stage: 'paymentReplacement',
      status: 'started',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: currentPayment,
        asset: selectedAsset,
      }),
      reason: 'accountChanged',
      sendStarted: sendStartedRef.current,
    });
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const isAttemptOwned = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current;
    const reloadCurrentSession = () => {
      submitInFlightRef.current = false;
      if (mountedRef.current) {
        onReloadPaymentSession();
      }
    };

    try {
      const result = await resolvePrimeInfiniPaymentAccountRebind({
        currentPayment,
        selectedAsset,
        sendStarted: sendStartedRef.current,
        fetchLatestPayment: (paymentId) =>
          backgroundApiProxy.servicePrime.apiGetInfiniPayment({
            paymentId,
            expectedOneKeyUserId: baseline.onekeyUserId ?? '',
          }),
        rebindPaymentSession: (latestPayment) =>
          sessionPersistenceQueueRef.current.finalize(() =>
            backgroundApiProxy.simpleDb.prime.rebindUnsentInfiniPendingPaymentSession(
              {
                onekeyUserId: baseline.onekeyUserId ?? '',
                expectedPaymentCacheIdentity: currentPaymentCacheKey,
                latestPayment,
                nextBindingId: createPrimeInfiniPaymentBindingId(),
                payerAccountId: accountId,
                payerAddress: accountAddress,
              },
            ),
          ),
        persistTrackedPayment: (trackedPayment) =>
          persistPaymentSession({
            nextPayment: trackedPayment,
            nextSendStarted: true,
          }),
        shouldContinue: isAttemptOwned,
      });

      if (result.type === 'cancelled') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'cancelled',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: selectedAsset,
          }),
          reason: 'accountSelectionAttemptStale',
          sendStarted: sendStartedRef.current,
        });
        submitInFlightRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        if (!isPurchaseUserCurrentRef.current) {
          setPhase('failed');
        } else {
          onReloadPaymentSession();
        }
        return;
      }
      if (result.type === 'track') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: result.payment,
            asset: selectedAsset,
          }),
          reason: 'paymentProgressDetected',
          sendStarted: true,
        });
        if (!isAttemptOwned()) {
          reloadCurrentSession();
          return;
        }
        paymentRef.current = result.payment;
        setPayment(result.payment);
        sendStartedRef.current = true;
        setSendStarted(true);
        submitInFlightRef.current = false;
        setPhase('polling');
        return;
      }
      logPrimeInfiniPaymentFlow({
        stage: 'paymentReplacement',
        status: 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentPayment,
          asset: selectedAsset,
        }),
        reason: 'payerAccountRebound',
        sendStarted: false,
      });
      reloadCurrentSession();
    } catch (error) {
      submitInFlightRef.current = false;
      if (!mountedRef.current) {
        return;
      }
      if (!isAttemptOwned()) {
        onReloadPaymentSession();
        return;
      }
      setPhase('replacementFailed');
      logPrimeInfiniPaymentFlow({
        stage: 'paymentReplacement',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentPayment,
          asset: selectedAsset,
        }),
        reason: 'accountReplacementFailed',
        sendStarted: sendStartedRef.current,
        error,
      });
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_network_error,
        }),
      });
    }
  }, [
    accountId,
    accountAddress,
    baseline.onekeyUserId,
    featureName,
    intl,
    onExitPreventedChange,
    onReloadPaymentSession,
    persistPaymentSession,
    phase,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
  ]);

  useEffect(() => {
    const currentPayment = paymentRef.current;
    if (submitInFlightRef.current || !isPurchaseUserCurrent) {
      return;
    }
    if (
      !shouldRebindPrimeInfiniPaymentForAccount({
        accountSyncReady,
        isSelectedNetworkReady,
        activeAccountId: accountId,
        activeAccountAddress: accountAddress,
        payerAccountId: paymentAccountIdRef.current,
        payerAddress: paymentAccountAddressRef.current,
        networkId: selectedAsset.networkId,
        phase,
        payment: currentPayment,
        sendStarted: sendStartedRef.current,
      })
    ) {
      return;
    }
    void rebindPaymentForAccountChange();
  }, [
    accountId,
    accountAddress,
    accountSyncReady,
    isPurchaseUserCurrent,
    isSelectedNetworkReady,
    phase,
    rebindPaymentForAccountChange,
    selectedAsset.networkId,
  ]);

  const handleSelectedAssetChange = useCallback(
    (nextAssetKey: string) => {
      if (
        nextAssetKey === selectedAsset.key ||
        submitInFlightRef.current ||
        !canInteractWithPaymentSelection
      ) {
        return;
      }
      const nextAsset = assets.find((asset) => asset.key === nextAssetKey);
      if (nextAsset) {
        logPrimeInfiniPaymentFlow({
          stage: 'assetSelection',
          status: 'selected',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: paymentRef.current,
            asset: nextAsset,
          }),
          sendStarted: sendStartedRef.current,
        });
      }
      if (!paymentRef.current) {
        replacementTargetAssetKeyRef.current = '';
        replacementSourceAssetRef.current = undefined;
        setPhase('selecting');
        onSelectedAssetChange(nextAssetKey);
        return;
      }
      onSelectedAssetChange(nextAssetKey);
      void replacePaymentForSelectionChange(nextAssetKey);
    },
    [
      assets,
      canInteractWithPaymentSelection,
      featureName,
      onSelectedAssetChange,
      plan,
      replacePaymentForSelectionChange,
      selectedAsset.key,
      selectedSubscriptionPeriod,
    ],
  );

  const handleOpenAssetSelector = useCallback(() => {
    if (!canInteractWithPaymentSelection) {
      return;
    }
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.PrimeInfiniPaymentAssetSelector,
      params: {
        assets,
        selectedAssetKey: selectedAsset.key,
        accountId,
        indexedAccountId: activeAccount.indexedAccount?.id,
        accountNetworkId: activeAccount.network?.id,
        onSelect: handleSelectedAssetChange,
      },
    });
  }, [
    accountId,
    activeAccount.indexedAccount?.id,
    activeAccount.network?.id,
    assets,
    canInteractWithPaymentSelection,
    handleSelectedAssetChange,
    navigation,
    selectedAsset.key,
  ]);

  useEffect(() => {
    const handleConfirmAccountSelected = (
      payload: IConfirmAccountSelectedPayload,
    ) => {
      const outcome = getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: accountSelectorOpenRef.current,
        initialSelectionIdentity: accountSelectorInitialIdentityRef.current,
        selectedAccount: actions.current.getSelectedAccount({ num: 0 }),
        confirmation: payload,
      });
      if (outcome === 'ignore') {
        return;
      }
      if (outcome === 'changed') {
        logPrimeInfiniPaymentFlow({
          stage: 'accountSelection',
          status: 'selected',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: paymentRef.current,
            asset: selectedAsset,
          }),
          sendStarted: sendStartedRef.current,
        });
        if (
          canChangePrimeInfiniPaymentSelection({
            phase: phaseRef.current,
            payment: paymentRef.current,
            sendStarted: sendStartedRef.current,
          }) &&
          phaseRef.current !== 'selecting'
        ) {
          setPhase('selecting');
        }
      }
      accountSelectorOpenRef.current = false;
      accountSelectorInitialIdentityRef.current = '';
    };
    appEventBus.on(
      EAppEventBusNames.ConfirmAccountSelected,
      handleConfirmAccountSelected,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ConfirmAccountSelected,
        handleConfirmAccountSelected,
      );
    };
  }, [actions, featureName, plan, selectedAsset, selectedSubscriptionPeriod]);

  useEffect(() => {
    if (!canChangeAccountSelection) {
      accountSelectorOpenRef.current = false;
      accountSelectorInitialIdentityRef.current = '';
    }
  }, [canChangeAccountSelection]);

  const handleShowAccountSelector = useCallback(() => {
    if (!canChangeAccountSelection) {
      return;
    }
    accountSelectorOpenRef.current = true;
    accountSelectorInitialIdentityRef.current =
      getPrimeInfiniAccountSelectionIdentity(
        actions.current.getSelectedAccount({ num: 0 }),
      );
    showAccountSelector();
  }, [actions, canChangeAccountSelection, showAccountSelector]);

  const preparePaymentForSelection = useCallback(async () => {
    const expectedOneKeyUserId = baseline.onekeyUserId;
    if (
      submitInFlightRef.current ||
      paymentRef.current ||
      phase !== 'selecting' ||
      !expectedOneKeyUserId ||
      !shouldCreatePayment ||
      !accountId ||
      !accountAddress ||
      !selectionIdentity ||
      !isOwnAccount ||
      !isPurchaseUserCurrent ||
      !accountSyncReady ||
      !isSelectedNetworkReady ||
      isPrimeInfiniExternalCheckoutInFlight()
    ) {
      return;
    }
    submitInFlightRef.current = true;
    onExitPreventedChange(true);
    setPhase('creating');
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const capturedSelectionIdentity = selectionIdentity;
    const capturedAsset = selectedAsset;
    const startedAt = Date.now();
    const capturedAccountId = accountId;
    const capturedAccountAddress = accountAddress;
    const isAttemptCurrent = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current &&
      !isPrimeInfiniExternalCheckoutInFlight() &&
      selectionIdentityRef.current === capturedSelectionIdentity;
    try {
      if (
        !(await ensurePrimePurchaseEligible({
          expectedOneKeyUserId,
        }))
      ) {
        submitInFlightRef.current = false;
        onExitPreventedChange(false);
        if (isAttemptCurrent()) {
          setPhase('replacementFailed');
        }
        return;
      }
      logPrimeInfiniPaymentFlow({
        stage: 'paymentCreation',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          asset: capturedAsset,
        }),
        sendStarted: false,
      });
      defaultLogger.prime.subscription.primeSubscribeIntent({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        currency: 'USD',
        paymentMethod: 'crypto',
      });
      const createdPayment =
        await backgroundApiProxy.servicePrime.apiCreateInfiniPayment({
          plan,
          chain: capturedAsset.chain,
          token: capturedAsset.token,
          expectedOneKeyUserId,
        });
      if (
        !isPrimeInfiniPaymentForAsset({
          payment: createdPayment,
          asset: capturedAsset,
        }) ||
        createdPayment.expiresAt <=
          Date.now() + MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS
      ) {
        throw new OneKeyLocalError(
          'Invalid Infini payment for the selected asset',
        );
      }
      if (!isAttemptCurrent()) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentCreation',
          status: 'cancelled',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: createdPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: 'selectionChangedBeforePersistence',
          sendStarted: false,
        });
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          setPhase(isPurchaseUserCurrentRef.current ? 'selecting' : 'failed');
        }
        return;
      }
      paymentAccountIdRef.current = capturedAccountId;
      paymentAccountAddressRef.current = capturedAccountAddress;
      await persistPaymentSession({
        nextPayment: createdPayment,
        nextPayerAccountId: capturedAccountId,
        nextPayerAddress: capturedAccountAddress,
        nextAsset: capturedAsset,
      });
      if (!isAttemptCurrent()) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentCreation',
          status: 'cancelled',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: createdPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: 'selectionChangedAfterPersistence',
          sendStarted: false,
        });
        submitInFlightRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        if (!isPurchaseUserCurrentRef.current) {
          onReloadPaymentSession();
          return;
        }
        try {
          const didDiscard = await discardPaymentSessionForSelectionChange(
            createdPayment.paymentId,
          );
          if (mountedRef.current) {
            if (didDiscard) {
              onRestartPaymentSession();
            } else {
              onReloadPaymentSession();
            }
          }
        } catch {
          if (mountedRef.current) {
            onReloadPaymentSession();
          }
        }
        return;
      }
      paymentRef.current = createdPayment;
      setPayment(createdPayment);
      submitInFlightRef.current = false;
      setPhase('selecting');
      logPrimeInfiniPaymentFlow({
        stage: 'paymentCreation',
        status: 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: createdPayment,
          asset: capturedAsset,
        }),
        durationMs: Date.now() - startedAt,
        sendStarted: false,
      });
    } catch (error) {
      if (!isAttemptCurrent()) {
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          setPhase(isPurchaseUserCurrentRef.current ? 'selecting' : 'failed');
        }
        return;
      }
      submitInFlightRef.current = false;
      setPhase('replacementFailed');
      logPrimeInfiniPaymentFlow({
        stage: 'paymentCreation',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          asset: capturedAsset,
        }),
        durationMs: Date.now() - startedAt,
        reason: 'createOrPersistFailed',
        sendStarted: false,
        error,
      });
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_network_error }),
      });
    }
  }, [
    accountId,
    accountAddress,
    accountSyncReady,
    baseline.onekeyUserId,
    discardPaymentSessionForSelectionChange,
    featureName,
    intl,
    isOwnAccount,
    isPurchaseUserCurrent,
    isSelectedNetworkReady,
    onExitPreventedChange,
    onReloadPaymentSession,
    onRestartPaymentSession,
    persistPaymentSession,
    phase,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
    selectionIdentity,
    shouldCreatePayment,
  ]);

  useEffect(() => {
    void preparePaymentForSelection();
  }, [preparePaymentForSelection]);

  const handleContinue = useCallback(async () => {
    let currentPayment = paymentRef.current;
    if (
      submitInFlightRef.current ||
      !canContinue ||
      !accountId ||
      !accountAddress ||
      !balanceDetail ||
      !currentPayment
    ) {
      return;
    }
    const initialPayment = currentPayment;
    submitInFlightRef.current = true;
    onExitPreventedChange(true);
    setPhase('creating');
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const capturedSelectionIdentity = selectionIdentity;
    const capturedAsset = selectedAsset;
    const startedAt = Date.now();
    const isAttemptCurrent = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current &&
      selectionIdentityRef.current === capturedSelectionIdentity;
    let paymentRefreshBlocked = false;
    let sendExitLogged = false;
    try {
      logPrimeInfiniPaymentFlow({
        stage: 'paymentPreflight',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentPayment,
          asset: capturedAsset,
        }),
        sendStarted: sendStartedRef.current,
      });
      const [refreshedPayment, freshBalanceDetails] = await Promise.all([
        backgroundApiProxy.servicePrime.apiGetInfiniPayment({
          paymentId: currentPayment.paymentId,
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
        }),
        backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId,
          networkId: capturedAsset.networkId,
          contractList: [capturedAsset.contractAddress],
          withFrozenBalance: true,
        }),
      ]);
      if (!isAttemptCurrent()) {
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          setPhase(isPurchaseUserCurrentRef.current ? 'selecting' : 'failed');
        }
        return;
      }
      if (
        shouldBlockPrimeInfiniPaymentRefresh({
          currentPayment: initialPayment,
          refreshedPayment,
          asset: capturedAsset,
        })
      ) {
        paymentRefreshBlocked = true;
        throw new OneKeyLocalError(
          'Invalid Infini payment for the selected asset',
        );
      }
      currentPayment = refreshedPayment;
      paymentRef.current = refreshedPayment;
      setPayment(refreshedPayment);
      await persistPaymentSession({ nextPayment: refreshedPayment });

      const preflightOutcome = getPrimeInfiniPaymentOutcome({
        payment: currentPayment,
      });
      if (
        preflightOutcome === 'confirmed' ||
        hasPrimeInfiniPaymentProgress(currentPayment)
      ) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentPreflight',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: 'paymentProgressDetected',
          sendStarted: true,
        });
        sendStartedRef.current = true;
        setSendStarted(true);
        await persistPaymentSession({
          nextPayment: currentPayment,
          nextSendStarted: true,
        });
        submitInFlightRef.current = false;
        setPhase('polling');
        return;
      }
      if (preflightOutcome === 'expired' || preflightOutcome === 'failed') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentPreflight',
          status: preflightOutcome,
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          sendStarted: false,
        });
        submitInFlightRef.current = false;
        setPhase(preflightOutcome);
        return;
      }
      if (
        currentPayment.expiresAt <=
        Date.now() + MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS
      ) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentPreflight',
          status: 'expired',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: 'sendSafetyWindowElapsed',
          sendStarted: false,
        });
        submitInFlightRef.current = false;
        setPhase('expired');
        return;
      }

      const freshBalanceDetail = freshBalanceDetails.find((item) =>
        isTokenAddressMatched({
          networkId: capturedAsset.networkId,
          expected: capturedAsset.contractAddress,
          actual: item.info.address,
        }),
      );
      if (!isAttemptCurrent()) {
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          setPhase(isPurchaseUserCurrentRef.current ? 'selecting' : 'failed');
        }
        return;
      }
      if (!freshBalanceDetail) {
        throw new OneKeyLocalError(
          'Infini payment token balance is unavailable',
        );
      }
      if (
        !isPrimeInfiniBalanceSufficient({
          balance: freshBalanceDetail.balanceParsed,
          amountDue: currentPayment.amountDue,
        })
      ) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentPreflight',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: 'insufficientBalance',
          sendStarted: false,
        });
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.swap_page_button_insufficient_balance,
          }),
        });
        setPhase('selecting');
        submitInFlightRef.current = false;
        return;
      }

      const paymentForSend = currentPayment;
      const purchaseUserIdForSend = baseline.onekeyUserId;
      const paymentCacheKeyForSend = paymentCacheKeyRef.current;
      if (
        !purchaseUserIdForSend ||
        !paymentCacheKeyForSend ||
        !isPrimeInfiniPaymentCacheKeyForContext({
          cacheKey: paymentCacheKeyForSend,
          payment: paymentForSend,
          asset: capturedAsset,
          onekeyUserId: purchaseUserIdForSend,
          plan,
          payerAccountId: accountId,
          payerAddress: accountAddress,
        })
      ) {
        throw new OneKeyLocalError(
          'Infini payment cache identity changed before send',
        );
      }
      let preSendBlockedPhase: IPaymentPhase | undefined;
      const recoverAfterSendExit = ({
        immediatePhase,
        fallbackPhase,
      }: {
        immediatePhase: IPaymentPhase;
        fallbackPhase: IPaymentPhase;
      }) => {
        if (!isAttemptCurrent()) {
          return;
        }
        void startPrimeInfiniPaymentSendExitRecovery({
          immediatePhase,
          fallbackPhase,
          resolveDidBroadcastStart: async () => {
            const persistedSession =
              await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession(
                { onekeyUserId: purchaseUserIdForSend },
              );
            return Boolean(
              persistedSession &&
              isSamePrimeInfiniPaymentCacheKey(
                persistedSession.paymentCacheKey,
                paymentCacheKeyForSend,
              ) &&
              persistedSession.sendStarted,
            );
          },
          shouldApply: isAttemptCurrent,
          onImmediate: (nextPhase) => {
            submitInFlightRef.current = false;
            onExitPreventedChange(false);
            setPhase(nextPhase);
          },
          onSettled: ({ didBroadcastStart, phase: nextPhase }) => {
            sendStartedRef.current = didBroadcastStart;
            setSendStarted(didBroadcastStart);
            setPhase(nextPhase);
            void refreshTokenBalances();
          },
          onRejected: (nextPhase) => {
            sendStartedRef.current = true;
            setSendStarted(true);
            setPhase(nextPhase);
          },
        });
      };
      onExitPreventedChange(true);
      setPhase('confirming');
      logPrimeInfiniPaymentFlow({
        stage: 'paymentPreflight',
        status: 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: paymentForSend,
          asset: capturedAsset,
        }),
        durationMs: Date.now() - startedAt,
        sendStarted: false,
      });
      logPrimeInfiniPaymentFlow({
        stage: 'sendConfirmation',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: paymentForSend,
          asset: capturedAsset,
        }),
        sendStarted: false,
      });
      const { transferInfo, transferPayload } =
        buildPrimeInfiniPaymentTransferIntent({
          accountId,
          accountAddress,
          asset: capturedAsset,
          payment: paymentForSend,
          tokenInfo: freshBalanceDetail.info,
        });
      await signatureConfirm.navigationToTxConfirm({
        transfersInfo: [transferInfo],
        transferPayload,
        isInternalTransfer: true,
        gasAccountScenario: 'send',
        broadcastDeadline: paymentForSend.expiresAt,
        beforeBroadcastAction: {
          type: 'primeInfiniPayment',
          paymentCacheKey: paymentCacheKeyForSend,
        },
        onBeforeSend: async () => {
          logPrimeInfiniPaymentFlow({
            stage: 'broadcast',
            status: 'started',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: paymentForSend,
              asset: capturedAsset,
            }),
            sendStarted: false,
          });
          if (!isAttemptCurrent()) {
            preSendBlockedPhase = 'failed';
            throw new OneKeyLocalError('Infini payment attempt is stale');
          }
          if (sendStartedRef.current) {
            preSendBlockedPhase = 'polling';
            setPhase('polling');
            throw new OneKeyLocalError('Infini payment send already started');
          }
          const persistedSession =
            await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession(
              { onekeyUserId: purchaseUserIdForSend },
            );
          if (
            !persistedSession ||
            !isSamePrimeInfiniPaymentCacheKey(
              persistedSession.paymentCacheKey,
              paymentCacheKeyForSend,
            )
          ) {
            preSendBlockedPhase = 'failed';
            setPhase('failed');
            throw new OneKeyLocalError('Infini payment session changed');
          }
          if (persistedSession.sendStarted) {
            preSendBlockedPhase = 'polling';
            sendStartedRef.current = true;
            setSendStarted(true);
            setPhase('polling');
            throw new OneKeyLocalError('Infini payment send already started');
          }
          const latestPayment =
            await backgroundApiProxy.servicePrime.apiGetInfiniPayment({
              paymentId: paymentForSend.paymentId,
              expectedOneKeyUserId: purchaseUserIdForSend,
            });
          if (!isAttemptCurrent()) {
            preSendBlockedPhase = 'failed';
            throw new OneKeyLocalError('Infini payment attempt is stale');
          }
          if (
            !isSamePrimeInfiniPaymentTransferSnapshot({
              first: paymentForSend,
              second: latestPayment,
              networkId: capturedAsset.networkId,
            }) ||
            !isPrimeInfiniPaymentForAsset({
              payment: latestPayment,
              asset: capturedAsset,
            })
          ) {
            preSendBlockedPhase = 'failed';
            setPhase('failed');
            throw new OneKeyLocalError('Infini payment changed before send');
          }
          paymentRef.current = latestPayment;
          setPayment(latestPayment);
          await persistPaymentSession({ nextPayment: latestPayment });
          const latestOutcome = getPrimeInfiniPaymentOutcome({
            payment: latestPayment,
          });
          if (
            latestOutcome === 'confirmed' ||
            hasPrimeInfiniPaymentProgress(latestPayment)
          ) {
            preSendBlockedPhase = 'polling';
            sendStartedRef.current = true;
            setSendStarted(true);
            await persistPaymentSession({
              nextPayment: latestPayment,
              nextSendStarted: true,
            });
            setPhase('polling');
            throw new OneKeyLocalError('Infini payment is already processing');
          }
          if (
            latestOutcome === 'expired' ||
            latestOutcome === 'failed' ||
            latestPayment.expiresAt <=
              Date.now() + MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS
          ) {
            preSendBlockedPhase =
              latestOutcome === 'failed' ? 'failed' : 'expired';
            setPhase(preSendBlockedPhase);
            throw new OneKeyLocalError('Infini payment is no longer sendable');
          }
          await persistPaymentSession({
            nextPayment: latestPayment,
            nextSendStarted: false,
          });
        },
        onSuccess: () => {
          sendExitLogged = true;
          logPrimeInfiniPaymentFlow({
            stage: 'broadcast',
            status: 'succeeded',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: paymentForSend,
              asset: capturedAsset,
            }),
            sendStarted: true,
          });
          if (!isAttemptCurrent()) {
            return;
          }
          submitInFlightRef.current = false;
          sendStartedRef.current = true;
          setSendStarted(true);
          setPhase('polling');
          void backgroundApiProxy.servicePrime
            .apiSyncInfiniWebhook({
              expectedOneKeyUserId: purchaseUserIdForSend,
            })
            .catch(() => undefined);
        },
        onFail: () => {
          sendExitLogged = true;
          logPrimeInfiniPaymentFlow({
            stage: 'broadcast',
            status: 'failed',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: paymentForSend,
              asset: capturedAsset,
            }),
            reason: 'sendFlowFailed',
            sendStarted: sendStartedRef.current,
          });
          recoverAfterSendExit({
            immediatePhase: 'polling',
            fallbackPhase:
              preSendBlockedPhase ??
              (Date.now() >= paymentForSend.expiresAt
                ? 'expired'
                : 'selecting'),
          });
        },
        onCancel: () => {
          sendExitLogged = true;
          logPrimeInfiniPaymentFlow({
            stage: 'sendConfirmation',
            status: 'cancelled',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: paymentForSend,
              asset: capturedAsset,
            }),
            sendStarted: sendStartedRef.current,
          });
          recoverAfterSendExit({
            immediatePhase: 'selecting',
            fallbackPhase: 'selecting',
          });
        },
      });
    } catch (error) {
      if (!isAttemptCurrent()) {
        submitInFlightRef.current = false;
        if (mountedRef.current) {
          setPhase(isPurchaseUserCurrentRef.current ? 'selecting' : 'failed');
        }
        return;
      }
      submitInFlightRef.current = false;
      if (!sendExitLogged) {
        logPrimeInfiniPaymentFlow({
          stage: paymentRefreshBlocked ? 'paymentPreflight' : 'broadcast',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: capturedAsset,
          }),
          durationMs: Date.now() - startedAt,
          reason: paymentRefreshBlocked
            ? 'paymentSnapshotMismatch'
            : 'preflightOrBroadcastFailed',
          sendStarted: sendStartedRef.current,
          error,
        });
      }
      if (paymentRefreshBlocked) {
        setPhase('replacementFailed');
        return;
      }
      setPhase(
        getPrimeInfiniPaymentErrorRecoveryPhase({
          sendStarted: sendStartedRef.current,
        }),
      );
      if (currentPayment) {
        paymentRef.current = currentPayment;
        setPayment(currentPayment);
        void persistPaymentSession({ nextPayment: currentPayment }).catch(
          () => undefined,
        );
      }
    }
  }, [
    accountAddress,
    accountId,
    balanceDetail,
    baseline.onekeyUserId,
    canContinue,
    featureName,
    intl,
    onExitPreventedChange,
    persistPaymentSession,
    plan,
    refreshTokenBalances,
    selectedAsset,
    selectedSubscriptionPeriod,
    selectionIdentity,
    signatureConfirm,
  ]);

  const handleRetry = useCallback(async () => {
    const currentPayment = paymentRef.current;
    if (
      !isPurchaseUserCurrent ||
      !currentPayment ||
      submitInFlightRef.current
    ) {
      return;
    }
    submitInFlightRef.current = true;
    onExitPreventedChange(true);
    setPhase('creating');
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const isAttemptOwned = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current;
    logPrimeInfiniPaymentFlow({
      stage: 'paymentReplacement',
      status: 'started',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: currentPayment,
        asset: selectedAsset,
      }),
      isRetry: true,
      reason: 'terminalPaymentRetry',
      sendStarted: sendStartedRef.current,
    });
    try {
      const result = await resolvePrimeInfiniPaymentReplacement({
        currentPayment,
        selectedAsset,
        sendStarted: sendStartedRef.current,
        fetchLatestPayment: (paymentId) =>
          backgroundApiProxy.servicePrime.apiGetInfiniPayment({
            paymentId,
            expectedOneKeyUserId: baseline.onekeyUserId ?? '',
          }),
        discardPaymentSession: discardPaymentSessionForSelectionChange,
        fetchPersistedPaymentSession: () =>
          backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
            onekeyUserId: baseline.onekeyUserId ?? '',
          }),
        persistTrackedPayment: (trackedPayment) =>
          persistPaymentSession({
            nextPayment: trackedPayment,
            nextSendStarted: true,
          }),
        shouldContinue: isAttemptOwned,
      });
      if (!isAttemptOwned()) {
        return;
      }
      if (result.type === 'cancelled') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'cancelled',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: selectedAsset,
          }),
          isRetry: true,
          reason: 'retryAttemptStale',
          sendStarted: sendStartedRef.current,
        });
        setPhase(
          getPrimeInfiniPaymentOutcome({ payment: currentPayment }) === 'failed'
            ? 'failed'
            : 'expired',
        );
        return;
      }
      if (result.type === 'reload') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'recovered',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: selectedAsset,
          }),
          isRetry: true,
          reason: 'sessionReloadRequired',
          sendStarted: sendStartedRef.current,
        });
        onReloadPaymentSession();
        return;
      }
      if (result.type === 'track') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: result.payment,
            asset: selectedAsset,
          }),
          isRetry: true,
          reason: 'paymentProgressDetected',
          sendStarted: true,
        });
        paymentRef.current = result.payment;
        setPayment(result.payment);
        sendStartedRef.current = true;
        setSendStarted(true);
        if (isAttemptOwned()) {
          setPhase('polling');
        }
        return;
      }
      logPrimeInfiniPaymentFlow({
        stage: 'paymentReplacement',
        status: 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentPayment,
          asset: selectedAsset,
        }),
        isRetry: true,
        reason: 'terminalPaymentRetired',
        sendStarted: false,
      });
      onDiscardPaymentSession(paymentBindingId);
    } catch (error) {
      if (isAttemptOwned()) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentPayment,
            asset: selectedAsset,
          }),
          isRetry: true,
          reason: 'terminalPaymentRetryFailed',
          sendStarted: sendStartedRef.current,
          error,
        });
        setPhase(
          getPrimeInfiniPaymentOutcome({ payment: currentPayment }) === 'failed'
            ? 'failed'
            : 'expired',
        );
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_network_error }),
        });
      }
    } finally {
      submitInFlightRef.current = false;
    }
  }, [
    baseline.onekeyUserId,
    discardPaymentSessionForSelectionChange,
    featureName,
    intl,
    isPurchaseUserCurrent,
    onDiscardPaymentSession,
    onExitPreventedChange,
    onReloadPaymentSession,
    paymentBindingId,
    persistPaymentSession,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
  ]);

  const proceedWithExternalCheckout = useCallback(
    async (
      closeExternalCheckoutConfirmation: ICloseExternalCheckoutConfirmation,
    ) => {
      if (submitInFlightRef.current || sendStartedRef.current) {
        await closeExternalCheckoutConfirmation();
        return;
      }
      const currentPayment = paymentRef.current;
      if (
        currentPayment &&
        !isPrimeInfiniPaymentReplaceable({
          payment: currentPayment,
          sendStarted: sendStartedRef.current,
        })
      ) {
        await closeExternalCheckoutConfirmation();
        return;
      }
      submitInFlightRef.current = true;
      onExitPreventedChange(true);
      setPhase('creating');
      const attemptGeneration = asyncAttemptGenerationRef.current + 1;
      asyncAttemptGenerationRef.current = attemptGeneration;
      const isAttemptOwned = () =>
        mountedRef.current &&
        asyncAttemptGenerationRef.current === attemptGeneration &&
        isPurchaseUserCurrentRef.current;
      let discardedPreparedPayment = false;
      let externalCheckoutAbortedForTracking = false;
      let reloadedPaymentSession = false;
      try {
        const didOpenCheckout = await onPayWithExternalWallet({
          selectedSubscriptionPeriod,
          featureName,
          beforeCheckout: async () => {
            if (!currentPayment) {
              return isAttemptOwned();
            }
            const result = await resolvePrimeInfiniPaymentReplacement({
              currentPayment,
              selectedAsset,
              sendStarted: sendStartedRef.current,
              fetchLatestPayment: (paymentId) =>
                backgroundApiProxy.servicePrime.apiGetInfiniPayment({
                  paymentId,
                  expectedOneKeyUserId: baseline.onekeyUserId ?? '',
                }),
              discardPaymentSession: discardPaymentSessionForSelectionChange,
              fetchPersistedPaymentSession: () =>
                backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession(
                  {
                    onekeyUserId: baseline.onekeyUserId ?? '',
                  },
                ),
              persistTrackedPayment: (trackedPayment) =>
                persistPaymentSession({
                  nextPayment: trackedPayment,
                  nextSendStarted: true,
                }),
              shouldContinue: isAttemptOwned,
            });
            if (!isAttemptOwned() || result.type === 'cancelled') {
              return false;
            }
            if (result.type === 'reload') {
              submitInFlightRef.current = false;
              reloadedPaymentSession = true;
              onReloadPaymentSession();
              return false;
            }
            if (result.type === 'track') {
              paymentRef.current = result.payment;
              setPayment(result.payment);
              sendStartedRef.current = true;
              setSendStarted(true);
              submitInFlightRef.current = false;
              externalCheckoutAbortedForTracking = true;
              if (isAttemptOwned()) {
                setPhase('polling');
              }
              return false;
            }
            paymentRef.current = undefined;
            paymentAccountIdRef.current = undefined;
            paymentAccountAddressRef.current = undefined;
            paymentCacheKeyRef.current = undefined;
            setPayment(undefined);
            discardedPreparedPayment = true;
            return true;
          },
          beforeOpenCheckout: async () => {
            // Commit the exit-guard update without starting either close
            // animation. Both overlays can then close in the same frame.
            onExitPreventedChange(false);
            await timerUtils.setTimeoutPromised();
            const closeConfirmationPromise = Promise.resolve(
              closeExternalCheckoutConfirmation(),
            );
            onClose();
            await Promise.all([
              closeConfirmationPromise,
              // The shared page-modal close transition lasts 250 ms.
              timerUtils.setTimeoutPromised(
                undefined,
                PRIME_PAYMENT_MODAL_CLOSE_DELAY_MS,
              ),
            ]);
          },
        });
        if (didOpenCheckout) {
          return;
        }
        await closeExternalCheckoutConfirmation();
        if (externalCheckoutAbortedForTracking || reloadedPaymentSession) {
          return;
        }
        if (!isAttemptOwned()) {
          submitInFlightRef.current = false;
          if (mountedRef.current) {
            onExitPreventedChange(false);
            onReloadPaymentSession();
          }
          return;
        }
        if (isAttemptOwned()) {
          submitInFlightRef.current = false;
          onExitPreventedChange(false);
          if (discardedPreparedPayment) {
            onReloadPaymentSession();
            return;
          }
          setPhase('selecting');
        }
      } catch (error) {
        await closeExternalCheckoutConfirmation();
        errorToastUtils.toastIfError(error);
        errorToastUtils.showToastOfError(error);
        if (isAttemptOwned()) {
          submitInFlightRef.current = false;
          onExitPreventedChange(false);
          if (discardedPreparedPayment) {
            onReloadPaymentSession();
            return;
          }
          setPhase('selecting');
        } else {
          submitInFlightRef.current = false;
          if (mountedRef.current) {
            onExitPreventedChange(false);
            onReloadPaymentSession();
          }
        }
      }
    },
    [
      baseline.onekeyUserId,
      discardPaymentSessionForSelectionChange,
      featureName,
      onClose,
      onExitPreventedChange,
      onPayWithExternalWallet,
      onReloadPaymentSession,
      persistPaymentSession,
      selectedAsset,
      selectedSubscriptionPeriod,
    ],
  );

  const handleExternalCheckout = useCallback(() => {
    logPrimeInfiniPaymentFlow({
      stage: 'paymentMethod',
      status: 'selected',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'externalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: paymentRef.current,
        asset: selectedAsset,
      }),
      sendStarted: sendStartedRef.current,
      reason: 'externalWalletSelectedFromInternalPayment',
    });
    Dialog.show({
      // TODO: i18n pending translation key
      title: 'Pay with an external wallet?',
      // TODO: i18n pending translation key
      description:
        'You’ll continue payment in your browser. The current in-app payment will be closed.',
      showFooter: true,
      showCancelButton: true,
      showConfirmButton: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onConfirm: async ({ close }) => {
        await proceedWithExternalCheckout(close);
      },
    });
  }, [
    featureName,
    intl,
    plan,
    proceedWithExternalCheckout,
    selectedAsset,
    selectedSubscriptionPeriod,
  ]);

  const handleReplacementRetry = useCallback(async () => {
    const targetAssetKey = replacementTargetAssetKeyRef.current;
    if (!targetAssetKey) {
      onRestartPaymentSession();
      return;
    }
    await replacePaymentForSelectionChange(targetAssetKey, {
      isRetry: true,
    });
  }, [onRestartPaymentSession, replacePaymentForSelectionChange]);

  const selectedNetwork = listedNetworkMap[displayAsset.networkId];
  const mustKeepTrackingPayment = Boolean(
    payment &&
    !isPrimeInfiniPaymentReplaceable({
      payment,
      sendStarted,
    }),
  );
  let inlinePaymentErrorTitle = paymentContextErrorTitle;
  if (!inlinePaymentErrorTitle) {
    if (phase === 'replacementFailed' || phase === 'retryableFailed') {
      inlinePaymentErrorTitle = intl.formatMessage({
        id: ETranslations.global_network_error,
      });
    } else if (phase === 'expired') {
      inlinePaymentErrorTitle = intl.formatMessage({
        id: ETranslations.send_the_invoice_has_expired,
      });
    } else if (phase === 'failed') {
      inlinePaymentErrorTitle = intl.formatMessage({
        id: ETranslations.global_failed,
      });
    }
  }
  const handleInlinePaymentErrorRetry = async () => {
    if (paymentContextErrorTitle) {
      await onRetryPaymentContext();
      return;
    }
    if (phase === 'replacementFailed') {
      await handleReplacementRetry();
      return;
    }
    if (phase === 'retryableFailed') {
      onReloadPaymentSession();
      return;
    }
    if (phase === 'expired' || phase === 'failed') {
      if (mustKeepTrackingPayment) {
        setPhase('polling');
      } else {
        await handleRetry();
      }
    }
  };
  const renderAccountCard = () => (
    <ListItem
      testID="prime-infini-account-selector"
      mx="$0"
      minHeight="$14"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      title={displayAccountName}
      subtitle={
        displayAccountAddress
          ? accountUtils.shortenAddress({ address: displayAccountAddress })
          : undefined
      }
      avatarProps={
        displayAccount
          ? {
              size: 'small',
              indexedAccount: displayActiveAccount.indexedAccount,
              account: displayAccount,
              dbAccount: displayActiveAccount.dbAccount,
              wallet: displayActiveAccount.wallet,
            }
          : undefined
      }
      icon={displayAccount ? undefined : 'WalletOutline'}
      disabled={!canChangeAccountSelection}
      onPress={
        canChangeAccountSelection ? handleShowAccountSelector : undefined
      }
    >
      <PrimeInfiniSelectorChevron />
    </ListItem>
  );
  const renderPaymentFooter = () => {
    if (phase === 'polling') {
      return (
        <PrimeInfiniPaymentFooter
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_refresh,
          })}
          confirmButtonProps={{ loading: polling.isPolling }}
          onConfirm={() => {
            polling.refresh();
          }}
        />
      );
    }
    if (inlinePaymentErrorTitle) {
      return (
        <PrimeInfiniPaymentFooter
          onConfirmText={intl.formatMessage({
            id:
              mustKeepTrackingPayment &&
              (phase === 'expired' || phase === 'failed')
                ? ETranslations.global_refresh
                : ETranslations.global_retry,
          })}
          confirmButtonProps={{
            disabled: paymentContextErrorTitle
              ? isPaymentContextRetrying
              : !isPurchaseUserCurrent,
            loading: Boolean(
              paymentContextErrorTitle && isPaymentContextRetrying,
            ),
          }}
          onConfirm={handleInlinePaymentErrorRetry}
          afterActionsContent={
            shouldRenderExternalCheckout ? (
              <PrimeInfiniExternalCheckoutLink
                testID="prime-infini-external-checkout"
                disabled={isSelectionDataRefreshing}
                onPress={handleExternalCheckout}
              />
            ) : undefined
          }
        />
      );
    }
    return (
      <PrimeInfiniPaymentFooter
        showConfirmButtonSkeleton={isPaymentButtonPreparing}
        onConfirmText={payButtonText}
        onConfirmContent={
          isPaymentButtonPreparing ? undefined : (
            <SizableText
              size="$bodyLgMedium"
              color="$textInverse"
              style={PRIME_PAYMENT_BUTTON_NUMERIC_STYLE}
              numberOfLines={1}
            >
              {payButtonText}
            </SizableText>
          )
        }
        confirmButtonProps={{
          disabled:
            isPaymentButtonPreparing ||
            !canContinue ||
            isCurrentBalanceInsufficient,
          loading:
            Boolean(displayPayment) &&
            (phase === 'creating' || phase === 'confirming'),
        }}
        onConfirm={async () => {
          await handleContinue();
        }}
        afterActionsContent={
          shouldRenderExternalCheckout ? (
            <PrimeInfiniExternalCheckoutLink
              testID="prime-infini-external-checkout"
              disabled={isSelectionDataRefreshing}
              onPress={handleExternalCheckout}
            />
          ) : undefined
        }
      />
    );
  };

  if (!shouldRenderPrimeInfiniPaymentSelection({ phase })) {
    return <PrimeInfiniPaymentCompletionStatus />;
  }

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_account })}
        </SizableText>
        {renderAccountCard()}
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
        <TokenListItem
          testID="prime-infini-asset-selector-trigger"
          mx="$0"
          minHeight="$14"
          borderWidth={1}
          borderColor="$borderSubdued"
          tokenImageSrc={displayBalanceDetail?.info.logoURI}
          networkImageSrc={selectedNetwork?.logoURI}
          tokenSymbol={displayAsset.token}
          tokenName={displayBalanceDetail?.info.name ?? displayAsset.token}
          tokenSymbolAccessory={
            <Badge badgeType="default" badgeSize="sm">
              {selectedNetwork?.name ?? displayAsset.chain}
            </Badge>
          }
          balance={displayBalanceDetail?.balanceParsed}
          valueProps={
            displayBalanceDetail?.fiatValue
              ? {
                  value: displayBalanceDetail.fiatValue,
                  currency: settings.currencyInfo.symbol,
                }
              : undefined
          }
          disabled={!canInteractWithPaymentSelection}
          onPress={
            canInteractWithPaymentSelection
              ? handleOpenAssetSelector
              : undefined
          }
          moreComponent={<PrimeInfiniSelectorChevron />}
        />
      </YStack>

      {accountId && !isOwnAccount ? (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.perp_trade_button_account_unsupported,
          })}
        />
      ) : null}
      {accountSyncFailed || hasBalanceError ? (
        <Alert
          type="warning"
          title={intl.formatMessage({ id: ETranslations.global_network_error })}
        />
      ) : null}

      {inlinePaymentErrorTitle ? (
        <Alert type="critical" title={inlinePaymentErrorTitle} />
      ) : null}

      {phase === 'polling' ? (
        <>
          <XStack gap="$2" alignItems="center">
            <Spinner size="small" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_processing })}
            </SizableText>
          </XStack>
          {polling.hasError ? (
            <Alert
              type="warning"
              title={intl.formatMessage({
                id: ETranslations.global_network_error,
              })}
            />
          ) : null}
        </>
      ) : null}

      {isCurrentBalanceInsufficient ? (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.swap_page_button_insufficient_balance,
          })}
        />
      ) : null}

      {platformEnv.isDev && displayPayment ? (
        <YStack testID="prime-infini-payment-id" gap="$1">
          {/* TODO: i18n pending translation key */}
          <SizableText color="$textSubdued">Payment ID</SizableText>
          <SizableText size="$bodySm" color="$textSubdued" userSelect="text">
            {displayPayment.paymentId}
          </SizableText>
        </YStack>
      ) : null}

      {renderPaymentFooter()}
    </YStack>
  );
}

function PrimeInfiniWalletPaymentRoot({
  plan,
  selectedSubscriptionPeriod,
  featureName,
  onPayWithExternalWallet,
  onClose,
  onExitPreventedChange,
  hasValidRouteParams,
  createNewPayment,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
  onPayWithExternalWallet: IPayWithExternalWallet;
  onClose: () => void;
  onExitPreventedChange: (isPrevented: boolean) => void;
  hasValidRouteParams: boolean;
  createNewPayment: boolean;
}) {
  const intl = useIntl();
  const [primeUserInfo] = usePrimePersistAtom();
  const [selectedAssetKey, setSelectedAssetKey] = useState('');
  const [discardedPaymentBindingIds, setDiscardedPaymentBindingIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [paymentSessionGeneration, setPaymentSessionGeneration] = useState(0);
  const [isErrorExternalCheckoutPending, setIsErrorExternalCheckoutPending] =
    useState(false);
  const [
    continuedExistingPaymentBindingId,
    setContinuedExistingPaymentBindingId,
  ] = useState('');
  const [isStartingForcedReplacement, setIsStartingForcedReplacement] =
    useState(false);
  const [
    failedCompletionFinalizationPaymentId,
    setFailedCompletionFinalizationPaymentId,
  ] = useState('');
  const [
    completionFinalizationRetryNonce,
    setCompletionFinalizationRetryNonce,
  ] = useState(0);
  const initialAccountSyncPromiseRef = useRef<Promise<void> | undefined>(
    undefined,
  );
  const completedPaymentHandledRef = useRef('');
  const paymentCreationIntentRef = useRef(createNewPayment);
  const forcedReplacementGenerationRef = useRef(0);
  const paymentContextLoadAttemptRef = useRef(0);
  useEffect(
    () => () => {
      forcedReplacementGenerationRef.current += 1;
    },
    [],
  );
  const { result, isLoading, run } = usePromiseResult<ILoadPaymentOptionsState>(
    async () => {
      const loadAttempt = paymentContextLoadAttemptRef.current + 1;
      paymentContextLoadAttemptRef.current = loadAttempt;
      const startedAt = Date.now();
      const shouldCreatePayment = paymentCreationIntentRef.current;
      logPrimeInfiniPaymentFlow({
        stage: 'paymentContext',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        isRetry: loadAttempt > 1,
      });
      const expectedOneKeyUserId = primeUserInfo.onekeyUserId;
      const purchaseStatusRequest = expectedOneKeyUserId
        ? backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot({
            expectedOneKeyUserId,
          })
        : Promise.reject(
            new OneKeyLocalError(
              'OneKey ID is missing for Infini purchase status',
            ),
          );
      const [optionsResult, purchaseStatusResult] = await Promise.allSettled([
        backgroundApiProxy.servicePrime.apiGetInfiniPaymentOptions(),
        purchaseStatusRequest,
      ]);
      const supportedAssets =
        optionsResult.status === 'fulfilled'
          ? getPrimeInfiniPaymentAssets(optionsResult.value)
          : [];
      const primeSubscription =
        purchaseStatusResult.status === 'fulfilled'
          ? purchaseStatusResult.value.primeSubscription
          : undefined;
      const onekeyUserId =
        purchaseStatusResult.status === 'fulfilled'
          ? purchaseStatusResult.value.onekeyUserId
          : undefined;
      const infiniSubscription =
        purchaseStatusResult.status === 'fulfilled'
          ? purchaseStatusResult.value.infiniSubscription
          : undefined;
      let sessionLoadFailed = false;
      let pendingSession: IPrimeInfiniPendingPaymentSession | undefined;
      let completedPaymentId: string | undefined;
      if (onekeyUserId) {
        try {
          const restoredSession = normalizePendingPaymentSession(
            await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession(
              { onekeyUserId },
            ),
          );
          if (restoredSession) {
            const canonicalAsset = getCanonicalPrimeInfiniPaymentAsset(
              restoredSession.asset,
            );
            if (!canonicalAsset) {
              sessionLoadFailed = true;
            } else {
              const restoreResult = await resolvePrimeInfiniPaymentRestore({
                session: {
                  ...restoredSession,
                  asset: canonicalAsset,
                },
                supportedAssets,
                paymentOptionsLoaded: optionsResult.status === 'fulfilled',
                createNewPayment: shouldCreatePayment,
                requestedPlan: plan,
                requestedSubscriptionPeriod: selectedSubscriptionPeriod,
                fetchLatestPayment: (paymentId) =>
                  backgroundApiProxy.servicePrime.apiGetInfiniPayment({
                    paymentId,
                    expectedOneKeyUserId: onekeyUserId,
                  }),
                fetchPurchaseStatusSnapshot: () =>
                  backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot(
                    {
                      expectedOneKeyUserId: onekeyUserId,
                    },
                  ),
                discardPaymentSession: (expectedPaymentCacheIdentity) =>
                  backgroundApiProxy.simpleDb.prime.discardUnsentInfiniPendingPaymentSession(
                    {
                      onekeyUserId,
                      expectedPaymentCacheIdentity,
                    },
                  ),
                clearCompletedPaymentSession: (expectedPaymentCacheIdentity) =>
                  backgroundApiProxy.simpleDb.prime.clearInfiniPendingPaymentSession(
                    {
                      onekeyUserId,
                      expectedPaymentCacheIdentity,
                    },
                  ),
                persistRestoredSession: (nextRestoredSession) =>
                  backgroundApiProxy.simpleDb.prime.setInfiniPendingPaymentSession(
                    {
                      onekeyUserId,
                      session: {
                        asset: nextRestoredSession.asset,
                        baseline: nextRestoredSession.baseline,
                        plan: nextRestoredSession.plan,
                        selectedSubscriptionPeriod:
                          nextRestoredSession.selectedSubscriptionPeriod,
                        featureName: nextRestoredSession.featureName,
                        payerAccountId: nextRestoredSession.payerAccountId,
                        payerAddress: nextRestoredSession.payerAddress,
                        paymentCacheKey: nextRestoredSession.paymentCacheKey,
                        payment: nextRestoredSession.payment,
                        sendStarted: nextRestoredSession.sendStarted,
                      },
                    },
                  ),
              });
              if (restoreResult.type === 'restore') {
                pendingSession = normalizePendingPaymentSession(
                  restoreResult.session,
                );
              } else if (restoreResult.type === 'completed') {
                completedPaymentId = restoredSession.payment.paymentId;
              }
            }
          }
        } catch (error) {
          sessionLoadFailed = true;
          logPrimeInfiniPaymentFlow({
            stage: 'paymentSession',
            status: 'failed',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            isRetry: loadAttempt > 1,
            reason: 'sessionRestoreFailed',
            error,
          });
        }
      }
      const assets =
        pendingSession &&
        !supportedAssets.some((asset) => asset.key === pendingSession.asset.key)
          ? [pendingSession.asset, ...supportedAssets]
          : supportedAssets;
      const wasPrimeActive = Boolean(primeSubscription?.isActive);
      const primeExpiresAt = wasPrimeActive
        ? primeSubscription?.expiresAt || undefined
        : undefined;
      let infiniPeriodEnd: number | undefined;
      if (wasPrimeActive) {
        infiniPeriodEnd = infiniSubscription?.currentPeriodEnd ?? 0;
      }
      const freshBaseline = {
        onekeyUserId,
        wasPrimeActive,
        primeExpiresAt,
        infiniPeriodEnd,
      };
      let hasError = false;
      if (!completedPaymentId) {
        hasError = pendingSession
          ? !onekeyUserId || assets.length === 0
          : !hasValidRouteParams ||
            sessionLoadFailed ||
            optionsResult.status === 'rejected' ||
            assets.length === 0 ||
            purchaseStatusResult.status === 'rejected' ||
            !onekeyUserId;
      }
      if (!hasError) {
        paymentCreationIntentRef.current = false;
      }
      const shouldShowExistingPaymentChoice = Boolean(
        shouldCreatePayment &&
        pendingSession &&
        !isPrimeInfiniPaymentReplaceable({
          payment: pendingSession.payment,
          sendStarted: pendingSession.sendStarted,
        }),
      );
      if (pendingSession) {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentSession',
          status: 'restored',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: pendingSession.payment,
            asset: pendingSession.asset,
          }),
          isRetry: loadAttempt > 1,
          durationMs: Date.now() - startedAt,
          sendStarted: pendingSession.sendStarted,
        });
      }
      let contextError: unknown;
      if (optionsResult.status === 'rejected') {
        contextError = optionsResult.reason;
      } else if (purchaseStatusResult.status === 'rejected') {
        contextError = purchaseStatusResult.reason;
      }
      let contextReason: string;
      if (hasError) {
        if (sessionLoadFailed) {
          contextReason = 'sessionRestoreFailed';
        } else if (optionsResult.status === 'rejected') {
          contextReason = 'paymentOptionsUnavailable';
        } else if (purchaseStatusResult.status === 'rejected') {
          contextReason = 'purchaseStatusUnavailable';
        } else if (!hasValidRouteParams) {
          contextReason = 'invalidPurchaseContext';
        } else if (!onekeyUserId) {
          contextReason = 'notLoggedIn';
        } else {
          contextReason = 'supportedAssetsUnavailable';
        }
      } else if (completedPaymentId) {
        contextReason = 'completedPaymentRestored';
      } else if (pendingSession) {
        contextReason = 'pendingPaymentRestored';
      } else {
        contextReason = 'readyForPaymentCreation';
      }
      logPrimeInfiniPaymentFlow({
        stage: 'paymentContext',
        status: hasError ? 'failed' : 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...(pendingSession
          ? getPrimeInfiniPaymentLogContext({
              payment: pendingSession.payment,
              asset: pendingSession.asset,
            })
          : undefined),
        isRetry: loadAttempt > 1,
        durationMs: Date.now() - startedAt,
        reason: contextReason,
        error: contextError,
      });
      return {
        assets,
        baseline: freshBaseline,
        pendingSession,
        completedPaymentId,
        shouldCreatePayment,
        shouldShowExistingPaymentChoice,
        canUseExternalCheckout: Boolean(
          hasValidRouteParams &&
          onekeyUserId &&
          !sessionLoadFailed &&
          !pendingSession &&
          !completedPaymentId,
        ),
        hasError,
      };
    },
    [
      featureName,
      hasValidRouteParams,
      plan,
      primeUserInfo.onekeyUserId,
      selectedSubscriptionPeriod,
    ],
    { watchLoading: true, undefinedResultIfReRun: false },
  );

  const effectivePendingSession =
    result?.pendingSession &&
    discardedPaymentBindingIds.has(
      result.pendingSession.paymentCacheKey.bindingId,
    )
      ? undefined
      : result?.pendingSession;
  const existingPaymentChoiceSession =
    result?.shouldShowExistingPaymentChoice &&
    effectivePendingSession &&
    continuedExistingPaymentBindingId !==
      effectivePendingSession.paymentCacheKey.bindingId
      ? effectivePendingSession
      : undefined;

  useEffect(() => {
    const completedPaymentId = result?.completedPaymentId;
    const onekeyUserId = result?.baseline.onekeyUserId;
    if (
      !completedPaymentId ||
      !onekeyUserId ||
      completedPaymentHandledRef.current === completedPaymentId
    ) {
      return;
    }
    completedPaymentHandledRef.current = completedPaymentId;
    setFailedCompletionFinalizationPaymentId('');
    onExitPreventedChange(true);
    logPrimeInfiniPaymentFlow({
      stage: 'purchaseCompletion',
      status: 'started',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      paymentId: completedPaymentId,
      sendStarted: true,
      reason: 'completedPaymentRestored',
    });
    void (async () => {
      const successPayload =
        await preparePrimeSubscriptionPurchaseSuccess(onekeyUserId);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.prime_payment_successful,
        }),
        message: intl.formatMessage({
          id: ETranslations.prime_payment_successful_description,
        }),
      });
      onClose();
      await timerUtils.wait(350);
      await finishPrimeSubscriptionPurchaseSuccess(successPayload);
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'succeeded',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        paymentId: completedPaymentId,
        sendStarted: true,
        reason: 'completedPaymentRestored',
      });
    })().catch((error) => {
      onExitPreventedChange(false);
      setFailedCompletionFinalizationPaymentId(completedPaymentId);
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        paymentId: completedPaymentId,
        sendStarted: true,
        reason: 'restoredCompletionFinalizationFailed',
        error,
      });
      errorToastUtils.showToastOfError(error);
    });
  }, [
    intl,
    featureName,
    onClose,
    onExitPreventedChange,
    result?.baseline.onekeyUserId,
    result?.completedPaymentId,
    plan,
    selectedSubscriptionPeriod,
    completionFinalizationRetryNonce,
  ]);
  const handleRetryCompletionFinalization = useCallback(() => {
    const completedPaymentId = result?.completedPaymentId;
    if (!completedPaymentId) {
      return;
    }
    completedPaymentHandledRef.current = '';
    setFailedCompletionFinalizationPaymentId('');
    setCompletionFinalizationRetryNonce((current) => current + 1);
  }, [result?.completedPaymentId]);

  const selectedAsset = useMemo(
    () =>
      result?.assets.find(
        (asset) =>
          asset.key ===
          (selectedAssetKey || effectivePendingSession?.asset.key),
      ) ?? result?.assets[0],
    [effectivePendingSession?.asset.key, result, selectedAssetKey],
  );
  const availableNetworksMap = useMemo(
    () =>
      selectedAsset
        ? {
            0: {
              networkIds: [selectedAsset.networkId],
              defaultNetworkId: selectedAsset.networkId,
            },
          }
        : undefined,
    [selectedAsset],
  );
  const handleDiscardPaymentSession = useCallback(
    (bindingId: string) => {
      paymentCreationIntentRef.current = true;
      setDiscardedPaymentBindingIds((current) => {
        return addPrimeInfiniDiscardedPaymentBindingId(current, bindingId);
      });
      setPaymentSessionGeneration((value) => value + 1);
      void run({ alwaysSetState: true });
    },
    [run],
  );
  const handleReplacePaymentSession = useCallback(
    ({ bindingId, assetKey }: { bindingId: string; assetKey: string }) => {
      paymentCreationIntentRef.current = true;
      setSelectedAssetKey(assetKey);
      setDiscardedPaymentBindingIds((current) => {
        return addPrimeInfiniDiscardedPaymentBindingId(current, bindingId);
      });
      setPaymentSessionGeneration((value) => value + 1);
      void run({ alwaysSetState: true });
    },
    [run],
  );
  const handleReloadPaymentSession = useCallback(() => {
    setSelectedAssetKey('');
    setPaymentSessionGeneration((value) => value + 1);
    void run({ alwaysSetState: true });
  }, [run]);
  const handleRestartPaymentSession = useCallback(() => {
    paymentCreationIntentRef.current = true;
    setPaymentSessionGeneration((value) => value + 1);
    void run({ alwaysSetState: true });
  }, [run]);
  const handleContinueExistingPayment = useCallback(() => {
    if (!existingPaymentChoiceSession) {
      return;
    }
    logPrimeInfiniPaymentFlow({
      stage: 'paymentSession',
      status: 'restored',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: existingPaymentChoiceSession.payment,
        asset: existingPaymentChoiceSession.asset,
      }),
      reason: 'userContinuedExistingPayment',
      sendStarted: existingPaymentChoiceSession.sendStarted,
    });
    setContinuedExistingPaymentBindingId(
      existingPaymentChoiceSession.paymentCacheKey.bindingId,
    );
  }, [
    existingPaymentChoiceSession,
    featureName,
    plan,
    selectedSubscriptionPeriod,
  ]);
  const handleStartForcedReplacement = useCallback(async () => {
    if (
      !existingPaymentChoiceSession ||
      isStartingForcedReplacement ||
      !result?.baseline.onekeyUserId
    ) {
      return;
    }
    const currentSession = existingPaymentChoiceSession;
    const onekeyUserId = result.baseline.onekeyUserId;
    const attemptGeneration = forcedReplacementGenerationRef.current + 1;
    forcedReplacementGenerationRef.current = attemptGeneration;
    const shouldContinue = () =>
      forcedReplacementGenerationRef.current === attemptGeneration;
    let handedOffToPaymentCreation = false;
    setIsStartingForcedReplacement(true);
    onExitPreventedChange(true);
    logPrimeInfiniPaymentFlow({
      stage: 'paymentReplacement',
      status: 'started',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: currentSession.payment,
        asset: currentSession.asset,
      }),
      reason: 'forceNewPaymentRequested',
      sendStarted: currentSession.sendStarted,
    });
    try {
      const replacementResult =
        await resolvePrimeInfiniPaymentForcedReplacement({
          currentSession,
          fetchLatestPayment: (paymentId) =>
            backgroundApiProxy.servicePrime.apiGetInfiniPayment({
              paymentId,
              expectedOneKeyUserId: onekeyUserId,
            }),
          fetchPurchaseStatusSnapshot: () =>
            backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot({
              expectedOneKeyUserId: onekeyUserId,
            }),
          archivePaymentSession: (latestPayment) =>
            backgroundApiProxy.simpleDb.prime.supersedeInfiniPendingPaymentSession(
              {
                onekeyUserId,
                expectedPaymentCacheIdentity: currentSession.paymentCacheKey,
                latestPayment,
              },
            ),
          persistTrackedPayment: (latestPayment) =>
            backgroundApiProxy.simpleDb.prime.setInfiniPendingPaymentSession({
              onekeyUserId,
              session: {
                asset: currentSession.asset,
                baseline: currentSession.baseline,
                plan: currentSession.plan,
                selectedSubscriptionPeriod:
                  currentSession.selectedSubscriptionPeriod,
                featureName: currentSession.featureName,
                payerAccountId: currentSession.payerAccountId,
                payerAddress: currentSession.payerAddress,
                paymentCacheKey: currentSession.paymentCacheKey,
                payment: latestPayment,
                sendStarted: true,
              },
            }),
          shouldContinue,
        });
      if (!shouldContinue() || replacementResult.type === 'cancelled') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'cancelled',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: currentSession.payment,
            asset: currentSession.asset,
          }),
          reason: 'forcedReplacementAttemptStale',
          sendStarted: currentSession.sendStarted,
        });
        return;
      }
      if (replacementResult.type === 'replace') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: replacementResult.payment,
            asset: currentSession.asset,
          }),
          reason: 'previousPaymentSuperseded',
          sendStarted: false,
        });
        paymentCreationIntentRef.current = true;
        setSelectedAssetKey(currentSession.asset.key);
        setIsStartingForcedReplacement(false);
        onExitPreventedChange(false);
        handedOffToPaymentCreation = true;
        await run({ alwaysSetState: true });
        return;
      }
      if (replacementResult.type === 'track') {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentReplacement',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: replacementResult.payment,
            asset: currentSession.asset,
          }),
          reason: 'paymentProgressDetected',
          sendStarted: true,
        });
        setContinuedExistingPaymentBindingId(
          currentSession.paymentCacheKey.bindingId,
        );
      }
      await run({ alwaysSetState: true });
    } catch (error) {
      logPrimeInfiniPaymentFlow({
        stage: 'paymentReplacement',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: currentSession.payment,
          asset: currentSession.asset,
        }),
        reason: 'forcedReplacementFailed',
        sendStarted: currentSession.sendStarted,
        error,
      });
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
    } finally {
      if (!handedOffToPaymentCreation) {
        setIsStartingForcedReplacement(false);
        onExitPreventedChange(false);
      }
    }
  }, [
    existingPaymentChoiceSession,
    featureName,
    isStartingForcedReplacement,
    onExitPreventedChange,
    result?.baseline.onekeyUserId,
    run,
    plan,
    selectedSubscriptionPeriod,
  ]);
  const handleErrorExternalCheckout = useCallback(async () => {
    if (isErrorExternalCheckoutPending) {
      return;
    }
    setIsErrorExternalCheckoutPending(true);
    onExitPreventedChange(true);
    let shouldRestoreExit = true;
    try {
      const didOpenCheckout = await onPayWithExternalWallet({
        selectedSubscriptionPeriod,
        featureName,
      });
      if (!didOpenCheckout) {
        return;
      }
      shouldRestoreExit = false;
      onClose();
    } catch (error) {
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
    } finally {
      if (shouldRestoreExit) {
        onExitPreventedChange(false);
        setIsErrorExternalCheckoutPending(false);
      }
    }
  }, [
    featureName,
    isErrorExternalCheckoutPending,
    onClose,
    onExitPreventedChange,
    onPayWithExternalWallet,
    selectedSubscriptionPeriod,
  ]);
  const externalCheckoutLink = (
    <PrimeInfiniExternalCheckoutLink
      testID="prime-infini-error-external-checkout"
      disabled={isErrorExternalCheckoutPending || Boolean(isLoading)}
      loading={isErrorExternalCheckoutPending}
      onPress={handleErrorExternalCheckout}
    />
  );
  const handleRetryPaymentContext = useCallback(async () => {
    await run({ alwaysSetState: true });
  }, [run]);

  const paymentContent = (() => {
    if (!result) {
      return <PrimeInfiniPaymentSkeleton />;
    }
    if (result.completedPaymentId) {
      return (
        <PrimeInfiniPaymentCompletionStatus
          hasError={
            failedCompletionFinalizationPaymentId === result.completedPaymentId
          }
          onRetry={handleRetryCompletionFinalization}
        />
      );
    }
    if (existingPaymentChoiceSession) {
      return (
        <PrimeInfiniExistingPaymentChoice
          session={existingPaymentChoiceSession}
          isStartingNewPayment={
            isStartingForcedReplacement || Boolean(isLoading)
          }
          onContinueExistingPayment={handleContinueExistingPayment}
          onStartNewPayment={handleStartForcedReplacement}
        />
      );
    }
    let paymentContextErrorTitle: string | undefined;
    if (!effectivePendingSession && !hasValidRouteParams) {
      // TODO: i18n pending translation key
      paymentContextErrorTitle =
        'Unable to start payment because the purchase context is invalid';
    } else if (!result.baseline.onekeyUserId) {
      // TODO: i18n pending translation key
      paymentContextErrorTitle = 'Please log in to your OneKey ID first';
    } else if (result.hasError) {
      paymentContextErrorTitle = intl.formatMessage({
        id: ETranslations.global_network_error,
      });
    }
    if (!selectedAsset || !availableNetworksMap) {
      return (
        <PrimeInfiniPaymentUnavailableSelection
          errorTitle={
            paymentContextErrorTitle ??
            intl.formatMessage({
              id: ETranslations.global_network_error,
            })
          }
          isRetrying={isErrorExternalCheckoutPending || Boolean(isLoading)}
          onRetry={handleRetryPaymentContext}
          afterActionsContent={
            result.canUseExternalCheckout ? externalCheckoutLink : undefined
          }
        />
      );
    }
    return (
      <PrimeInfiniWalletPaymentContent
        key={`${
          effectivePendingSession?.paymentCacheKey.bindingId ?? 'new-payment'
        }:${paymentSessionGeneration}`}
        plan={effectivePendingSession?.plan ?? plan}
        selectedSubscriptionPeriod={
          effectivePendingSession?.selectedSubscriptionPeriod ??
          selectedSubscriptionPeriod
        }
        featureName={effectivePendingSession?.featureName ?? featureName}
        assets={result.assets}
        selectedAsset={selectedAsset}
        baseline={effectivePendingSession?.baseline ?? result.baseline}
        pendingSession={effectivePendingSession}
        onSelectedAssetChange={setSelectedAssetKey}
        onDiscardPaymentSession={handleDiscardPaymentSession}
        onReplacePaymentSession={handleReplacePaymentSession}
        onReloadPaymentSession={handleReloadPaymentSession}
        onRestartPaymentSession={handleRestartPaymentSession}
        onPayWithExternalWallet={onPayWithExternalWallet}
        onClose={onClose}
        onExitPreventedChange={onExitPreventedChange}
        initialAccountSyncPromiseRef={initialAccountSyncPromiseRef}
        isOptionsRefreshing={Boolean(isLoading)}
        paymentContextErrorTitle={paymentContextErrorTitle}
        isPaymentContextRetrying={Boolean(isLoading)}
        onRetryPaymentContext={handleRetryPaymentContext}
        shouldCreatePayment={
          !paymentContextErrorTitle &&
          (result.shouldCreatePayment || paymentCreationIntentRef.current)
        }
      />
    );
  })();

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.primePayment }}
      enabledNum={ACCOUNT_SELECTOR_ENABLED_NUM}
      availableNetworksMap={availableNetworksMap}
    >
      {paymentContent}
    </AccountSelectorProviderMirror>
  );
}

export default function PrimeInfiniWalletPayment() {
  const navigation = useAppNavigation<IPageNavigationProp<IPrimeParamList>>();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeInfiniPayment>();
  const createNewPaymentRef = useRef(route.params?.createNewPayment === true);
  const { purchaseByExternalCheckout } = usePrimeInfiniPurchase();
  const [isExitPrevented, setIsExitPrevented] = useState(false);
  const exitPreventedRef = useRef(isExitPrevented);
  const closeRequestedRef = useRef(false);
  exitPreventedRef.current = isExitPrevented;

  usePreventRemove(isExitPrevented, () => {});

  useEffect(() => {
    if (closeRequestedRef.current && !isExitPrevented) {
      navigation.pop();
    }
  }, [isExitPrevented, navigation]);

  useEffect(() => {
    if (route.params?.createNewPayment) {
      navigation.setParams({ createNewPayment: undefined });
    }
  }, [navigation, route.params?.createNewPayment]);

  const closePaymentPage = useCallback(() => {
    if (closeRequestedRef.current) {
      return;
    }
    closeRequestedRef.current = true;
    if (!exitPreventedRef.current) {
      navigation.pop();
      return;
    }
    exitPreventedRef.current = false;
    setIsExitPrevented(false);
  }, [navigation]);

  const selectedSubscriptionPeriod = route.params?.selectedSubscriptionPeriod;
  const routeFeatureName = route.params?.featureName;
  const featureName =
    routeFeatureName && PRIME_FEATURE_VALUES.has(routeFeatureName)
      ? routeFeatureName
      : undefined;
  const hasValidRouteParams =
    selectedSubscriptionPeriod === 'P1Y' ||
    selectedSubscriptionPeriod === 'P1M';
  const effectiveSubscriptionPeriod =
    selectedSubscriptionPeriod === 'P1M' ? 'P1M' : 'P1Y';
  const plan: IPrimeInfiniSubscriptionPlan =
    effectiveSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
  const isCryptoPaymentSupported =
    !platformEnv.isNativeIOS && !platformEnv.isNativeAndroidGooglePlay;

  useEffect(() => {
    if (isCryptoPaymentSupported) {
      return;
    }
    Toast.error({
      // TODO: i18n pending translation key
      title: 'Crypto payments are not available on this platform',
    });
    closePaymentPage();
  }, [closePaymentPage, isCryptoPaymentSupported]);

  return (
    <Page testID="prime-infini-payment-page" scrollEnabled>
      <Page.Header headerTitle={PRIME_PAY_WITH_CRYPTO_LABEL} />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$4">
          {isCryptoPaymentSupported ? (
            <PrimeInfiniWalletPaymentRoot
              plan={plan}
              selectedSubscriptionPeriod={effectiveSubscriptionPeriod}
              featureName={featureName}
              onPayWithExternalWallet={purchaseByExternalCheckout}
              onClose={closePaymentPage}
              onExitPreventedChange={setIsExitPrevented}
              hasValidRouteParams={hasValidRouteParams}
              createNewPayment={createNewPaymentRef.current}
            />
          ) : (
            <Stack alignItems="center" py="$6">
              <Spinner size="large" />
            </Stack>
          )}
        </YStack>
      </Page.Body>
    </Page>
  );
}
