/* cspell:ignore Infini */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { PRIME_INFINI_MIN_PAYMENT_VALIDITY_MS } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  buildPrimeInfiniPaymentCacheKey,
  createPrimeInfiniPaymentBindingId,
  isPrimeInfiniPaymentCacheKeyForContext,
  isSamePrimeInfiniPaymentCacheKey,
  isSamePrimeInfiniPaymentTransferSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentErrorFailure,
  getPrimeInfiniPaymentValidationFailure,
  toPrimeInfiniPaymentPersistenceError,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import {
  getPrimeInfiniPaymentWarningsFingerprint,
  hasUnconfirmedPrimeInfiniPaymentWarnings,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentWarnings';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPrimeInfiniPendingPaymentSession as IPersistedPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentFlowContext,
  IPrimeInfiniPaymentValidationFailure,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import {
  isPrimeInfiniPaymentAccountSyncReady,
  resolvePrimeInfiniPaymentAsset,
  resolvePrimeInfiniPaymentDisplaySnapshot,
  resolvePrimeInfiniPaymentPinnedAssetKey,
  shouldShowPrimeInfiniExternalCheckoutLink,
  shouldShowPrimeInfiniPaymentButtonSkeleton,
} from '../hooks/primeInfiniPaymentDisplaySnapshot';
import {
  type IPrimeInfiniPaymentReloadRequest,
  resolvePrimeInfiniPaymentReloadCommit,
} from '../hooks/primeInfiniPaymentReload';
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
  isPrimeInfiniPaymentReplaceable,
  isPrimeInfiniPaymentWithinSendSafetyWindow,
  shouldBlockPrimeInfiniPaymentRefresh,
  shouldRenderPrimeInfiniPaymentSelection,
} from '../hooks/primeInfiniPaymentUtils';
import { confirmPrimeInfiniPaymentWarnings } from '../hooks/primeInfiniPaymentWarnings';
import {
  capturePrimeInfiniSessionRevision,
  releasePrimeInfiniTerminalSession,
} from '../hooks/primeInfiniTerminalRelease';
import {
  isPrimeInfiniExternalCheckoutInFlight,
  usePrimeInfiniPurchase,
} from '../hooks/usePrimeInfiniPurchase';
import { showPrimeInfiniPaymentErrorToast } from '../primeInfiniPaymentError';
import {
  getPrimeInfiniPaymentLocalError,
  logPrimeInfiniPaymentFlow,
} from '../primeInfiniPaymentLogger';
import { ensurePrimePurchaseEligible } from '../primePurchaseEligibility';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../primeSubscriptionPurchaseSuccess';

import { showPrimeInfiniPaymentWarnings } from './PrimeInfiniPaymentWarnings';
import { showPrimeInfiniWaitingDialog } from './PrimeInfiniWaitingDialog';
import { usePrimePurchaseCallback } from './PrimePurchaseDialog/PrimePurchaseDialog';

import type { IPrimeInfiniPaymentSessionRevision } from '../hooks/primeInfiniPaymentReplacement';
import type {
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentPhase,
  IPrimeInfiniPurchaseBaseline,
} from '../hooks/primeInfiniPaymentUtils';
import type { ISubscriptionPeriod } from '../hooks/usePrimePaymentTypes';

const ACCOUNT_SELECTOR_ENABLED_NUM = [0];
const PrimeInfiniPaymentFlowContext = createContext<
  IPrimeInfiniPaymentFlowContext | undefined
>(undefined);
const MIN_PAYMENT_VALIDITY_BEFORE_SEND_MS =
  PRIME_INFINI_MIN_PAYMENT_VALIDITY_MS;
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
    expectedChain: asset.chain,
    expectedToken: asset.token,
    actualChain: payment?.chain,
    actualToken: payment?.token,
    remainingMs: payment ? payment.expiresAt - Date.now() : undefined,
    hasPaymentProgress: payment
      ? hasPrimeInfiniPaymentProgress(payment)
      : false,
  };
}

type ILoadPaymentOptionsState = {
  loadAttempt: number;
  assets: IPrimeInfiniPaymentAsset[];
  baseline: IPrimeInfiniPurchaseBaseline;
  hasError: boolean;
  canUseExternalCheckout: boolean;
  shouldCreatePayment: boolean;
  shouldShowExistingPaymentChoice: boolean;
  staleExistingPaymentSession?: IPrimeInfiniPendingPaymentSession;
  pendingSession?: IPrimeInfiniPendingPaymentSession;
  completedPaymentId?: string;
  contextError?: unknown;
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
  flowId?: string;
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
  const intl = useIntl();
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
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.prime_pay_with_external_wallet__action,
            })}
          </SizableText>
          <Icon name="ArrowTopRightOutline" size="$4" color="$iconSubdued" />
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
  const flowContextRef = useRef(useContext(PrimeInfiniPaymentFlowContext));
  const intl = useIntl();
  const [confirmButtonMinWidth, setConfirmButtonMinWidth] = useState<number>();
  const handleConfirm = useCallback(() => {
    void Promise.resolve(onConfirm?.()).catch((error) => {
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
        stage: 'paymentContext',
        status: 'failed',
        reason: 'paymentActionRejected',
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    });
  }, [intl, onConfirm]);
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
  isPaymentStateStale,
  onContinueExistingPayment,
  onStartNewPayment,
}: {
  session: IPrimeInfiniPendingPaymentSession;
  isStartingNewPayment: boolean;
  isPaymentStateStale: boolean;
  onContinueExistingPayment: () => void;
  onStartNewPayment: () => Promise<void>;
}) {
  const flowContextRef = useRef(useContext(PrimeInfiniPaymentFlowContext));
  const intl = useIntl();
  const handleStartNewPayment = useCallback(() => {
    void onStartNewPayment().catch((error) => {
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
        stage: 'paymentReplacement',
        status: 'failed',
        subscriptionPeriod: session.selectedSubscriptionPeriod,
        plan: session.plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment: session.payment,
          asset: session.asset,
        }),
        reason: 'startNewPaymentActionRejected',
        sendStarted: session.sendStarted,
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.prime_payment_start_failed__msg,
        }),
      });
    });
  }, [intl, onStartNewPayment, session]);

  return (
    <>
      <YStack gap="$4">
        <Alert
          type="warning"
          title={intl.formatMessage({
            id: ETranslations.prime_unfinished_payment__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.prime_unfinished_payment__desc,
          })}
        />
        {isPaymentStateStale ? (
          // The amounts below come from the local record because the server
          // could not be reached for this invoice. Presenting them as current
          // would let someone read a stale "0 confirming" as proof they never
          // paid, which is exactly the judgement this screen asks them to make.
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: ETranslations.prime_payment_refresh_failed__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.prime_payment_stale__desc,
            })}
          />
        ) : null}
        <YStack
          gap="$3"
          p="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
        >
          <XStack justifyContent="space-between" gap="$3">
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.prime_payment_amount__label,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountDue} {session.payment.token}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" gap="$3">
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.prime_payment_confirmed__label,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountConfirmed ?? '0'} {session.payment.token}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" gap="$3">
            <SizableText color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_confirming })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {session.payment.amountConfirming ?? '0'} {session.payment.token}
            </SizableText>
          </XStack>
          {isPaymentStateStale ? (
            <YStack gap="$1">
              <SizableText color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.prime_recipient_address__label,
                })}
              </SizableText>
              <SizableText size="$bodySm" userSelect="text">
                {session.payment.address}
              </SizableText>
            </YStack>
          ) : null}
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
        <Page.FooterActions
          // The close callbacks are unused on purpose: declaring the parameter
          // opts out of FooterCancelButton's auto-pop, and continuing the
          // existing payment must never navigate away.
          onCancel={(_close) => {
            onContinueExistingPayment();
          }}
          onCancelText={intl.formatMessage({
            id: ETranslations.prime_keep_waiting__action,
          })}
          cancelButtonProps={{
            testID: 'prime-infini-continue-existing-payment',
            disabled: isStartingNewPayment,
          }}
          onConfirm={() => {
            handleStartNewPayment();
          }}
          onConfirmText={intl.formatMessage({
            id: ETranslations.prime_start_new_payment__action,
          })}
          confirmButtonProps={{
            testID: 'prime-infini-start-new-payment',
            loading: isStartingNewPayment,
            disabled: isStartingNewPayment,
          }}
        />
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
  onPaymentSessionPersisted,
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
  // Reports every binding this content persisted, so the root can keep its
  // loader re-runs from bouncing an in-flow payment back to the choice screen.
  onPaymentSessionPersisted: (bindingId: string) => void;
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
  const flowContextRef = useRef(useContext(PrimeInfiniPaymentFlowContext));
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
  // External wallets send during signing and skip ServiceSend's broadcast
  // branch, including Infini invoice validation, expiry checks, and the
  // sendStarted claim that prevents duplicate payments. Keep them excluded
  // until external sends support equivalent safeguards.
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
  const [paymentValidationFailure, setPaymentValidationFailure] = useState<
    IPrimeInfiniPaymentValidationFailure | undefined
  >(() =>
    pendingSession &&
    !pendingSession.sendStarted &&
    !hasPrimeInfiniPaymentProgress(pendingSession.payment)
      ? getPrimeInfiniPaymentValidationFailure({
          payment: pendingSession.payment,
          asset: selectedAsset,
        })
      : undefined,
  );
  const [isPaymentWithinSendSafetyWindow, setIsPaymentWithinSendSafetyWindow] =
    useState(false);
  const [sendStarted, setSendStarted] = useState(
    pendingSession?.sendStarted ?? false,
  );
  const [accountSyncFailed, setAccountSyncFailed] = useState(false);
  const [accountSyncedNetworkId, setAccountSyncedNetworkId] = useState('');
  const accountSyncReady = isPrimeInfiniPaymentAccountSyncReady({
    syncedNetworkId: accountSyncedNetworkId,
    selectedNetworkId: selectedAsset.networkId,
  });
  const paymentRef = useRef(payment);
  paymentRef.current = payment;
  const validationPaymentRef = useRef(payment);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const sendStartedRef = useRef(sendStarted);
  sendStartedRef.current = sendStarted;
  const sessionCreatedAtRef = useRef(
    pendingSession?.createdAt ?? pendingSession?.updatedAt,
  );
  if (flowContextRef.current) {
    flowContextRef.current = {
      ...flowContextRef.current,
      expectedChain: selectedAsset.chain,
      expectedToken: selectedAsset.token,
      createNewPaymentIntent: shouldCreatePayment,
      sessionMode: sendStarted ? 'tracking' : 'quote',
      sendStarted,
      hasPaymentProgress: payment
        ? hasPrimeInfiniPaymentProgress(payment)
        : false,
      sessionAgeMs:
        sessionCreatedAtRef.current === undefined
          ? undefined
          : Date.now() - sessionCreatedAtRef.current,
    };
  }
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
  const waitingDialogHandoffRef = useRef('');
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
  const balanceErrorToastSelectionRef = useRef('');
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
    issues: balanceIssues,
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
      const persistedSession = await sessionPersistenceQueueRef.current
        .persist(async () => {
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
                  flowId: flowContextRef.current?.flowId,
                },
              },
            );
          paymentCacheKeyRef.current = storedSession.paymentCacheKey;
          paymentAssetRef.current = storedSession.asset;
          sessionCreatedAtRef.current =
            storedSession.createdAt ?? storedSession.updatedAt;
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
            ...getPrimeInfiniPaymentLogContext({
              payment: storedSession.payment,
              asset: storedSession.asset,
            }),
            stage: 'sessionPersistence',
            status: 'succeeded',
            sessionAgeMs:
              Date.now() - (storedSession.createdAt ?? storedSession.updatedAt),
            sessionMode: storedSession.sendStarted ? 'tracking' : 'quote',
            sendStarted: storedSession.sendStarted,
          });
          return storedSession;
        })
        .catch((error: unknown) => {
          const persistenceError = toPrimeInfiniPaymentPersistenceError(error);
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
            stage: 'sessionPersistence',
            status: 'failed',
            error: persistenceError,
          });
          throw persistenceError;
        });
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
      onPaymentSessionPersisted(normalizedSession.paymentCacheKey.bindingId);
      return normalizedSession;
    },
    [
      baseline,
      featureName,
      onPaymentSessionPersisted,
      paymentBindingId,
      plan,
      selectedSubscriptionPeriod,
    ],
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

  // Releases an invoice the server closed with nothing collected. The ordinary
  // discard above refuses it once sendStarted is latched, which would strand
  // the user on a dead payment with no way to change the selection.
  const captureTerminalPaymentSessionRevision = useCallback(async () => {
    const onekeyUserId = baseline.onekeyUserId;
    if (!onekeyUserId) {
      return undefined;
    }
    return capturePrimeInfiniSessionRevision({
      queue: sessionPersistenceQueueRef.current,
      fetchPersistedSession: () =>
        backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
          onekeyUserId,
        }),
      onError: (error) => {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'paymentSession',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: paymentRef.current,
            asset: selectedAsset,
          }),
          reason: 'terminalSessionRevisionUnavailable',
          sendStarted: sendStartedRef.current,
          error,
        });
      },
    });
  }, [
    baseline.onekeyUserId,
    featureName,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
  ]);

  const discardTerminalPaymentSessionForSelectionChange = useCallback(
    async (
      latestPayment: IPrimeInfiniPayment,
      sessionRevision: IPrimeInfiniPaymentSessionRevision | undefined,
    ) => {
      const onekeyUserId = baseline.onekeyUserId;
      const expectedPaymentCacheIdentity = paymentCacheKeyRef.current;
      if (
        !onekeyUserId ||
        expectedPaymentCacheIdentity?.paymentId !== latestPayment.paymentId
      ) {
        return false;
      }
      return releasePrimeInfiniTerminalSession({
        queue: sessionPersistenceQueueRef.current,
        discardTerminalSession: () =>
          backgroundApiProxy.simpleDb.prime.discardTerminalInfiniPendingPaymentSession(
            {
              onekeyUserId,
              expectedPaymentCacheIdentity,
              // Revision pinned before the caller's remote fetch. Absent means
              // there was no session then, and the DB layer still refuses if
              // one has appeared since.
              expectedUpdatedAt: sessionRevision?.updatedAt ?? 0,
              expectedSendStarted: sessionRevision?.sendStarted ?? false,
              latestPayment,
            },
          ),
      });
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
    setAccountSyncedNetworkId('');
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
        setAccountSyncedNetworkId(selectedAsset.networkId);
      }
    })().catch((error) => {
      if (accountSyncGenerationRef.current === generation) {
        initialAccountSyncPromiseRef.current = undefined;
        setAccountSyncedNetworkId('');
        setAccountSyncFailed(true);
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'accountSelection',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: paymentRef.current,
            asset: selectedAsset,
          }),
          reason: 'accountSyncFailed',
          sendStarted: sendStartedRef.current,
          error,
        });
        showPrimeInfiniPaymentErrorToast({
          error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      }
    });
    return () => {
      if (accountSyncGenerationRef.current === generation) {
        accountSyncGenerationRef.current += 1;
      }
    };
  }, [
    actions,
    featureName,
    initialAccountSyncPromiseRef,
    intl,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
  ]);

  useEffect(() => {
    if (payment && isAuthReady && !isPurchaseUserCurrent) {
      asyncAttemptGenerationRef.current += 1;
      submitInFlightRef.current = false;
      setPhase('failed');
    }
  }, [isAuthReady, isPurchaseUserCurrent, payment]);

  useEffect(() => {
    if (
      phase !== 'polling' ||
      !sendStarted ||
      !payment ||
      !baseline.onekeyUserId
    ) {
      return;
    }
    const payerAccountId = paymentAccountIdRef.current;
    const payerAddress = paymentAccountAddressRef.current;
    const paymentCacheKey = paymentCacheKeyRef.current;
    const handoffKey = `${payment.paymentId}:${paymentCacheKey?.bindingId ?? ''}`;
    if (
      waitingDialogHandoffRef.current === handoffKey ||
      !payerAccountId ||
      !payerAddress ||
      !paymentCacheKey
    ) {
      return;
    }
    waitingDialogHandoffRef.current = handoffKey;
    submitInFlightRef.current = false;
    onExitPreventedChange(false);
    const waitingSession: IPrimeInfiniPendingPaymentSession = {
      schemaVersion: 2,
      flowId: flowContextRef.current?.flowId,
      createdAt: sessionCreatedAtRef.current,
      asset: paymentAssetRef.current,
      baseline: {
        ...baseline,
        onekeyUserId: baseline.onekeyUserId,
      },
      plan,
      selectedSubscriptionPeriod,
      featureName,
      payerAccountId,
      payerAddress,
      paymentCacheKey,
      payment,
      sendStarted: true,
      updatedAt: Date.now(),
    };
    void (async () => {
      await timerUtils.setTimeoutPromised();
      onClose();
      await timerUtils.setTimeoutPromised(
        undefined,
        PRIME_PAYMENT_MODAL_CLOSE_DELAY_MS,
      );
      showPrimeInfiniWaitingDialog({
        context: {
          checkoutType: 'internalWallet',
          session: waitingSession,
        },
      });
    })().catch((error) => {
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
        stage: 'paymentPolling',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        ...getPrimeInfiniPaymentLogContext({
          payment,
          asset: waitingSession.asset,
        }),
        sendStarted: true,
        reason: 'waitingDialogHandoffFailed',
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    });
  }, [
    baseline,
    featureName,
    intl,
    onClose,
    onExitPreventedChange,
    payment,
    phase,
    plan,
    selectedSubscriptionPeriod,
    sendStarted,
  ]);

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
  const balanceError = useMemo(() => {
    if (!hasBalanceError) {
      return undefined;
    }
    return (
      balanceIssues?.[0] ??
      new OneKeyLocalError(
        'Unable to load the selected account and token balance',
      )
    );
  }, [balanceIssues, hasBalanceError]);
  useEffect(() => {
    if (!balanceError || !selectionIdentity) {
      balanceErrorToastSelectionRef.current = '';
      return;
    }
    if (balanceErrorToastSelectionRef.current === selectionIdentity) {
      return;
    }
    balanceErrorToastSelectionRef.current = selectionIdentity;
    logPrimeInfiniPaymentFlow({
      ...flowContextRef.current,
      stage: 'accountSelection',
      status: 'failed',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      plan,
      checkoutType: 'internalWallet',
      ...getPrimeInfiniPaymentLogContext({
        payment: paymentRef.current,
        asset: selectedAsset,
      }),
      reason: 'balanceUnavailable',
      sendStarted: sendStartedRef.current,
      error: balanceError,
    });
    showPrimeInfiniPaymentErrorToast({
      error: balanceError,
      fallbackMessage: intl.formatMessage({
        id: ETranslations.global_failed,
      }),
    });
  }, [
    balanceError,
    featureName,
    intl,
    plan,
    selectedAsset,
    selectedSubscriptionPeriod,
    selectionIdentity,
  ]);
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
  const currentSelectionSnapshot =
    useMemo<IPrimeInfiniPaymentSelectionSnapshot>(
      () => ({
        accountDisplayName,
        activeAccount,
        asset: selectedAsset,
        balanceDetail,
      }),
      [accountDisplayName, activeAccount, balanceDetail, selectedAsset],
    );
  const isSelectionSnapshotReady = Boolean(
    selectionIdentity && accountSyncReady && !accountSyncFailed,
  );
  const [lastReadySelectionSnapshot, setLastReadySelectionSnapshot] = useState<
    IPrimeInfiniPaymentSelectionSnapshot | undefined
  >();
  useEffect(() => {
    if (isSelectionSnapshotReady) {
      setLastReadySelectionSnapshot(currentSelectionSnapshot);
    }
  }, [currentSelectionSnapshot, isSelectionSnapshotReady]);
  const {
    selectionSnapshot: displaySelectionSnapshot,
    payment: displayPayment,
  } = resolvePrimeInfiniPaymentDisplaySnapshot<
    IPrimeInfiniPaymentSelectionSnapshot,
    IPrimeInfiniPayment
  >({
    selectionSnapshot: currentSelectionSnapshot,
    lastReadySelectionSnapshot,
    isSelectionReady: isSelectionSnapshotReady,
    payment,
    isPaymentCurrent: isPaymentCacheContextCurrent,
  });
  const displayPaymentRef = useRef(displayPayment);
  displayPaymentRef.current = displayPayment;
  const displayActiveAccount = displaySelectionSnapshot.activeAccount;
  const displayAccount = displayActiveAccount.account;
  const displayAccountAddress = displayAccount?.address;
  const displayAccountName = displaySelectionSnapshot.accountDisplayName;
  const displayAsset = displaySelectionSnapshot.asset;
  const displayBalanceDetail = displaySelectionSnapshot.balanceDetail;
  const displaySelectionIdentity =
    displayAccount?.id &&
    displayAccountAddress &&
    displayActiveAccount.ready &&
    displayActiveAccount.network?.id === displayAsset.networkId &&
    !displayActiveAccount.isNetworkNotMatched
      ? `${displayAccount.id}:${displayAccountAddress}:${
          displayAsset.networkId
        }:${displayAsset.contractAddress}`
      : '';
  const isDisplayedSelectionCurrent =
    Boolean(displaySelectionIdentity) &&
    displaySelectionIdentity === selectionIdentity;
  const displaySelectionIdentityRef = useRef(displaySelectionIdentity);
  displaySelectionIdentityRef.current = displaySelectionIdentity;
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
      isOptionsRefreshing,
    });
  const canContinue = Boolean(
    phase === 'selecting' &&
    payment &&
    displayPayment &&
    isPaymentCacheContextCurrent &&
    isDisplayedSelectionCurrent &&
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
      if (
        (isExpired || isWithinSendSafetyWindow) &&
        phaseRef.current === 'selecting' &&
        !sendStartedRef.current
      ) {
        setPaymentValidationFailure(
          isExpired ? 'quoteExpired' : 'quoteValidityTooShort',
        );
        setPhase('expired');
      }
    },
    [],
  );
  const paymentExpiryCountdown = usePrimeInfiniPaymentExpiryCountdown({
    expiresAt: displayPayment?.expiresAt,
    onStateChange: handlePaymentExpiryStateChange,
  });
  useEffect(() => {
    if (
      phase !== 'selecting' ||
      !payment ||
      sendStarted ||
      hasPrimeInfiniPaymentProgress(payment)
    ) {
      return;
    }
    const failure = getPrimeInfiniPaymentValidationFailure({
      payment,
      asset: selectedAsset,
    });
    if (failure === 'quoteExpired' || failure === 'quoteValidityTooShort') {
      setPaymentValidationFailure(failure);
      setPhase('expired');
    }
  }, [payment, phase, selectedAsset, sendStarted]);
  const payButtonText = displayPayment
    ? `${intl.formatMessage(
        {
          id: ETranslations.prime_pay_amount__action,
        },
        {
          amount: displayPayment.amountDue,
          token: displayPayment.token,
        },
      )}${paymentExpiryCountdown ? ` · ${paymentExpiryCountdown}` : ''}`
    : intl.formatMessage({
        id: ETranslations.global_pay,
      });

  useEffect(() => {
    if (accountSyncFailed && accountId && isSelectedNetworkReady) {
      initialAccountSyncPromiseRef.current ??= Promise.resolve();
      setAccountSyncFailed(false);
      setAccountSyncedNetworkId(selectedAsset.networkId);
    }
  }, [
    accountId,
    accountSyncFailed,
    initialAccountSyncPromiseRef,
    isSelectedNetworkReady,
    selectedAsset.networkId,
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
        ...flowContextRef.current,
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
              flowContext: flowContextRef.current,
              paymentId,
              expectedOneKeyUserId: baseline.onekeyUserId ?? '',
            }),
          discardPaymentSession: discardPaymentSessionForSelectionChange,
          captureSessionRevision: captureTerminalPaymentSessionRevision,
          discardTerminalPaymentSession:
            discardTerminalPaymentSessionForSelectionChange,
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
            ...flowContextRef.current,
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
            ...flowContextRef.current,
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
            ...flowContextRef.current,
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
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
        showPrimeInfiniPaymentErrorToast({
          error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      }
    },
    [
      baseline.onekeyUserId,
      assets,
      discardPaymentSessionForSelectionChange,
      captureTerminalPaymentSessionRevision,
      discardTerminalPaymentSessionForSelectionChange,
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
      ...flowContextRef.current,
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
            flowContext: flowContextRef.current,
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
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
        ...flowContextRef.current,
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
        ...flowContextRef.current,
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
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
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
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
      isOptionsRefreshing ||
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
    setPaymentValidationFailure(undefined);
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
          intl,
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
        ...flowContextRef.current,
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
          flowContext: flowContextRef.current,
          plan,
          chain: capturedAsset.chain,
          token: capturedAsset.token,
          expectedOneKeyUserId,
        });
      const validationFailure = getPrimeInfiniPaymentValidationFailure({
        payment: createdPayment,
        asset: capturedAsset,
        validateQuote: !hasPrimeInfiniPaymentProgress(createdPayment),
      });
      validationPaymentRef.current = createdPayment;
      if (
        validationFailure &&
        validationFailure !== 'quoteExpired' &&
        validationFailure !== 'quoteValidityTooShort'
      ) {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          ...getPrimeInfiniPaymentLogContext({
            payment: createdPayment,
            asset: capturedAsset,
          }),
          stage: 'responseValidation',
          status: 'failed',
          failureReason: validationFailure,
          paymentSource: 'createResponse',
        });
        throw createPrimeInfiniPaymentValidationError(validationFailure, {
          expectedChain: capturedAsset.chain,
          expectedToken: capturedAsset.token,
          actualChain: createdPayment.chain,
          actualToken: createdPayment.token,
        });
      }
      if (!isAttemptCurrent()) {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
      const createdSession = await persistPaymentSession({
        nextPayment: createdPayment,
        nextPayerAccountId: capturedAccountId,
        nextPayerAddress: capturedAccountAddress,
        nextAsset: capturedAsset,
      });
      if (!isAttemptCurrent()) {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
        } catch (error) {
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
            stage: 'paymentSession',
            status: 'failed',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            ...getPrimeInfiniPaymentLogContext({
              payment: createdPayment,
              asset: capturedAsset,
            }),
            reason: 'staleCreatedPaymentCleanupFailed',
            sendStarted: false,
            error,
          });
          if (mountedRef.current) {
            onReloadPaymentSession();
          }
        }
        return;
      }
      paymentRef.current = createdPayment;
      setPayment(createdPayment);
      submitInFlightRef.current = false;
      setPaymentValidationFailure(validationFailure);
      sendStartedRef.current = createdSession.sendStarted;
      setSendStarted(createdSession.sendStarted);
      let createdPhase: IPaymentPhase = validationFailure
        ? 'expired'
        : 'selecting';
      if (createdSession.sendStarted) {
        createdPhase = 'polling';
      }
      setPhase(createdPhase);
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
        stage: 'responseValidation',
        status: validationFailure ? 'blocked' : 'succeeded',
        failureReason: validationFailure,
        paymentSource: 'createResponse',
        ...getPrimeInfiniPaymentLogContext({
          payment: createdPayment,
          asset: capturedAsset,
        }),
      });
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
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
      setPaymentValidationFailure(getPrimeInfiniPaymentErrorFailure(error));
      setPhase('replacementFailed');
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
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
        reason: getPrimeInfiniPaymentErrorFailure(error) ?? 'apiRequestFailed',
        sendStarted: false,
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
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
    isOptionsRefreshing,
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
    const currentPaymentSnapshot = paymentRef.current;
    const capturedDisplayPayment = displayPaymentRef.current;
    const capturedDisplaySelectionIdentity =
      displaySelectionIdentityRef.current;
    const capturedAsset = displayAsset;
    if (
      submitInFlightRef.current ||
      !canContinue ||
      !displayAccount?.id ||
      !displayAccountAddress ||
      !balanceDetail ||
      !currentPaymentSnapshot ||
      !capturedDisplayPayment ||
      !capturedDisplaySelectionIdentity ||
      capturedDisplaySelectionIdentity !== selectionIdentity ||
      shouldBlockPrimeInfiniPaymentRefresh({
        currentPayment: capturedDisplayPayment,
        refreshedPayment: currentPaymentSnapshot,
        asset: capturedAsset,
      })
    ) {
      return;
    }
    let currentPayment = capturedDisplayPayment;
    const initialPayment = currentPayment;
    submitInFlightRef.current = true;
    onExitPreventedChange(true);
    setPhase('creating');
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const capturedSelectionIdentity = capturedDisplaySelectionIdentity;
    const startedAt = Date.now();
    const capturedAccountId = displayAccount.id;
    const capturedAccountAddress = displayAccountAddress;
    const isAttemptCurrent = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current &&
      selectionIdentityRef.current === capturedSelectionIdentity &&
      displaySelectionIdentityRef.current === capturedSelectionIdentity &&
      Boolean(
        displayPaymentRef.current &&
        isSamePrimeInfiniPaymentTransferSnapshot({
          first: capturedDisplayPayment,
          second: displayPaymentRef.current,
          networkId: capturedAsset.networkId,
        }),
      );
    let paymentRefreshBlocked = false;
    let sendExitLogged = false;
    try {
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
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
          flowContext: flowContextRef.current,
          paymentId: currentPayment.paymentId,
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
        }),
        backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId: capturedAccountId,
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
      const refreshFailure = getPrimeInfiniPaymentValidationFailure({
        previousPayment: initialPayment,
        payment: refreshedPayment,
        asset: capturedAsset,
        validateQuote: false,
      });
      validationPaymentRef.current = refreshedPayment;
      if (refreshFailure) {
        paymentRefreshBlocked = true;
        throw createPrimeInfiniPaymentValidationError(refreshFailure);
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
          ...flowContextRef.current,
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
        setPaymentValidationFailure(
          preflightOutcome === 'expired' ? 'quoteExpired' : undefined,
        );
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
        setPaymentValidationFailure(
          getPrimeInfiniPaymentValidationFailure({
            payment: currentPayment,
            asset: capturedAsset,
          }),
        );
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
          payerAccountId: capturedAccountId,
          payerAddress: capturedAccountAddress,
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
            void refreshTokenBalances().catch((error) => {
              logPrimeInfiniPaymentFlow({
                ...flowContextRef.current,
                stage: 'accountSelection',
                status: 'failed',
                subscriptionPeriod: selectedSubscriptionPeriod,
                featureName,
                plan,
                checkoutType: 'internalWallet',
                ...getPrimeInfiniPaymentLogContext({
                  payment: paymentForSend,
                  asset: capturedAsset,
                }),
                reason: 'postSendBalanceRefreshFailed',
                sendStarted: didBroadcastStart,
                error,
              });
              showPrimeInfiniPaymentErrorToast({
                error,
                fallbackMessage: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
            });
          },
          onRejected: (nextPhase, error) => {
            sendStartedRef.current = true;
            setSendStarted(true);
            setPhase(nextPhase);
            logPrimeInfiniPaymentFlow({
              ...flowContextRef.current,
              stage: 'paymentSession',
              status: 'failed',
              subscriptionPeriod: selectedSubscriptionPeriod,
              featureName,
              plan,
              checkoutType: 'internalWallet',
              ...getPrimeInfiniPaymentLogContext({
                payment: paymentForSend,
                asset: capturedAsset,
              }),
              reason: 'sendExitReconciliationFailed',
              sendStarted: true,
              error,
            });
          },
        });
      };
      if (
        !(await confirmPrimeInfiniPaymentWarnings({
          payment: currentPayment,
          confirmWarnings: (messages) =>
            showPrimeInfiniPaymentWarnings(messages, intl),
          shouldContinue: isAttemptCurrent,
        }))
      ) {
        submitInFlightRef.current = false;
        onExitPreventedChange(false);
        if (isAttemptCurrent()) {
          setPhase('selecting');
        }
        return;
      }
      const confirmedQuoteFailure = getPrimeInfiniPaymentValidationFailure({
        payment: currentPayment,
        asset: capturedAsset,
      });
      if (confirmedQuoteFailure) {
        throw createPrimeInfiniPaymentValidationError(confirmedQuoteFailure);
      }
      setPaymentValidationFailure(undefined);
      onExitPreventedChange(true);
      setPhase('confirming');
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
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
        ...flowContextRef.current,
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
          accountId: capturedAccountId,
          accountAddress: capturedAccountAddress,
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
          flowContext: flowContextRef.current,
          confirmedWarningsFingerprint:
            getPrimeInfiniPaymentWarningsFingerprint(paymentForSend),
          paymentCacheKey: paymentCacheKeyForSend,
        },
        onBeforeSend: async () => {
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
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
          const [persistedSession, latestPayment] = await Promise.all([
            backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
              onekeyUserId: purchaseUserIdForSend,
            }),
            backgroundApiProxy.servicePrime.apiGetInfiniPayment({
              flowContext: flowContextRef.current,
              paymentId: paymentForSend.paymentId,
              expectedOneKeyUserId: purchaseUserIdForSend,
            }),
          ]);
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
          if (!isAttemptCurrent()) {
            preSendBlockedPhase = 'failed';
            throw new OneKeyLocalError('Infini payment attempt is stale');
          }
          const beforeSendFailure = getPrimeInfiniPaymentValidationFailure({
            previousPayment: paymentForSend,
            payment: latestPayment,
            asset: capturedAsset,
            validateQuote: false,
          });
          if (beforeSendFailure) {
            setPaymentValidationFailure(beforeSendFailure);
            preSendBlockedPhase = 'failed';
            setPhase('failed');
            throw createPrimeInfiniPaymentValidationError(beforeSendFailure);
          }
          if (
            hasUnconfirmedPrimeInfiniPaymentWarnings({
              payment: latestPayment,
              confirmedWarningsFingerprint:
                getPrimeInfiniPaymentWarningsFingerprint(paymentForSend),
            })
          ) {
            preSendBlockedPhase = 'selecting';
            setPaymentValidationFailure('transferSnapshotChanged');
            throw createPrimeInfiniPaymentValidationError(
              'transferSnapshotChanged',
            );
          }
          paymentRef.current = latestPayment;
          setPayment(latestPayment);
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
            setPaymentValidationFailure(
              getPrimeInfiniPaymentValidationFailure({
                payment: latestPayment,
                asset: capturedAsset,
              }),
            );
            await persistPaymentSession({
              nextPayment: latestPayment,
              nextSendStarted: false,
            });
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
            ...flowContextRef.current,
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
            .catch((error) => {
              logPrimeInfiniPaymentFlow({
                ...flowContextRef.current,
                stage: 'paymentPolling',
                status: 'failed',
                subscriptionPeriod: selectedSubscriptionPeriod,
                featureName,
                plan,
                checkoutType: 'internalWallet',
                ...getPrimeInfiniPaymentLogContext({
                  payment: paymentForSend,
                  asset: capturedAsset,
                }),
                reason: 'postBroadcastWebhookSyncFailed',
                sendStarted: true,
                error,
              });
            });
        },
        onFail: () => {
          sendExitLogged = true;
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
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
            ...flowContextRef.current,
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
      const validationFailure = getPrimeInfiniPaymentErrorFailure(error);
      setPaymentValidationFailure(validationFailure);
      let failureReason = 'preflightOrBroadcastFailed';
      if (paymentRefreshBlocked) {
        failureReason = 'paymentSnapshotMismatch';
      } else if (sendExitLogged) {
        failureReason = 'sendFlowErrorPropagated';
      }
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
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
        reason: failureReason,
        sendStarted: sendStartedRef.current,
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
      if (
        validationFailure === 'quoteExpired' ||
        validationFailure === 'quoteValidityTooShort'
      ) {
        setPhase('expired');
        return;
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
          (persistError) => {
            logPrimeInfiniPaymentFlow({
              ...flowContextRef.current,
              stage: 'paymentSession',
              status: 'failed',
              subscriptionPeriod: selectedSubscriptionPeriod,
              featureName,
              plan,
              checkoutType: 'internalWallet',
              ...getPrimeInfiniPaymentLogContext({
                payment: currentPayment,
                asset: capturedAsset,
              }),
              reason: 'postFailureSessionPersistenceFailed',
              sendStarted: sendStartedRef.current,
              error: persistError,
            });
          },
        );
      }
    }
  }, [
    balanceDetail,
    baseline.onekeyUserId,
    canContinue,
    featureName,
    intl,
    onExitPreventedChange,
    persistPaymentSession,
    plan,
    refreshTokenBalances,
    displayAsset,
    displayAccount?.id,
    displayAccountAddress,
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
    setPaymentValidationFailure(undefined);
    onExitPreventedChange(true);
    setPhase('creating');
    const attemptGeneration = asyncAttemptGenerationRef.current + 1;
    asyncAttemptGenerationRef.current = attemptGeneration;
    const isAttemptOwned = () =>
      mountedRef.current &&
      asyncAttemptGenerationRef.current === attemptGeneration &&
      isPurchaseUserCurrentRef.current;
    logPrimeInfiniPaymentFlow({
      ...flowContextRef.current,
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
        allowTerminalRelease: false,
        allowChangedUnsentQuote: true,
        fetchLatestPayment: (paymentId) =>
          backgroundApiProxy.servicePrime.apiGetInfiniPayment({
            flowContext: flowContextRef.current,
            paymentId,
            expectedOneKeyUserId: baseline.onekeyUserId ?? '',
          }),
        discardPaymentSession: discardPaymentSessionForSelectionChange,
        captureSessionRevision: captureTerminalPaymentSessionRevision,
        discardTerminalPaymentSession:
          discardTerminalPaymentSessionForSelectionChange,
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
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
        ...flowContextRef.current,
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
          ...flowContextRef.current,
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
        setPaymentValidationFailure(getPrimeInfiniPaymentErrorFailure(error));
        setPhase(
          getPrimeInfiniPaymentOutcome({ payment: currentPayment }) === 'failed'
            ? 'failed'
            : 'expired',
        );
        showPrimeInfiniPaymentErrorToast({
          error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      }
    } finally {
      submitInFlightRef.current = false;
    }
  }, [
    baseline.onekeyUserId,
    discardPaymentSessionForSelectionChange,
    captureTerminalPaymentSessionRevision,
    discardTerminalPaymentSessionForSelectionChange,
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
          flowId: flowContextRef.current?.flowId,
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
              allowTerminalRelease: false,
              allowChangedUnsentQuote: true,
              confirmLatestPayment: (latestPayment) =>
                confirmPrimeInfiniPaymentWarnings({
                  payment: latestPayment,
                  confirmWarnings: (messages) =>
                    showPrimeInfiniPaymentWarnings(messages, intl),
                  shouldContinue: isAttemptOwned,
                }),
              fetchLatestPayment: (paymentId) =>
                backgroundApiProxy.servicePrime.apiGetInfiniPayment({
                  flowContext: flowContextRef.current,
                  paymentId,
                  expectedOneKeyUserId: baseline.onekeyUserId ?? '',
                }),
              discardPaymentSession: discardPaymentSessionForSelectionChange,
              captureSessionRevision: captureTerminalPaymentSessionRevision,
              discardTerminalPaymentSession:
                discardTerminalPaymentSessionForSelectionChange,
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
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'externalCheckout',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'externalWallet',
          ...getPrimeInfiniPaymentLogContext({
            payment: paymentRef.current,
            asset: selectedAsset,
          }),
          reason: 'externalCheckoutHandoffFailed',
          sendStarted: sendStartedRef.current,
          error,
        });
        showPrimeInfiniPaymentErrorToast({
          error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
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
      captureTerminalPaymentSessionRevision,
      discardTerminalPaymentSessionForSelectionChange,
      featureName,
      intl,
      onClose,
      onExitPreventedChange,
      onPayWithExternalWallet,
      onReloadPaymentSession,
      persistPaymentSession,
      plan,
      selectedAsset,
      selectedSubscriptionPeriod,
    ],
  );

  const handleExternalCheckout = useCallback(() => {
    logPrimeInfiniPaymentFlow({
      ...flowContextRef.current,
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
      title: intl.formatMessage({
        id: ETranslations.prime_pay_with_external_wallet__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_external_wallet_checkout__desc,
      }),
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
  const balanceErrorMessage = balanceError
    ? getPrimeInfiniPaymentLocalError(balanceError).errorMessage
    : undefined;
  const mustKeepTrackingPayment = Boolean(
    payment &&
    !isPrimeInfiniPaymentReplaceable({
      payment,
      sendStarted,
    }),
  );
  let inlinePaymentErrorTitle = paymentContextErrorTitle;
  if (!inlinePaymentErrorTitle && paymentValidationFailure && !isBusy) {
    const failedPayment = validationPaymentRef.current;
    inlinePaymentErrorTitle = createPrimeInfiniPaymentValidationError(
      paymentValidationFailure,
      failedPayment
        ? {
            expectedChain: selectedAsset.chain,
            expectedToken: selectedAsset.token,
            actualChain: failedPayment.chain,
            actualToken: failedPayment.token,
          }
        : undefined,
    ).message;
  }
  if (!inlinePaymentErrorTitle) {
    if (phase === 'replacementFailed' || phase === 'retryableFailed') {
      inlinePaymentErrorTitle = intl.formatMessage({
        id: ETranslations.global_failed,
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
    if (phase === 'selecting' && paymentValidationFailure) {
      await handleContinue();
      return;
    }
    if (phase === 'replacementFailed') {
      if (paymentRef.current) {
        await handleRetry();
      } else {
        await handleReplacementRetry();
      }
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
              size: 'medium',
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
                disabled={isOptionsRefreshing}
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
              size="$bodyMdMedium"
              $gtMd={{ size: '$bodyLgMedium' }}
              color="$textInverse"
              style={PRIME_PAYMENT_BUTTON_NUMERIC_STYLE}
              minWidth={0}
              flexShrink={1}
              textAlign="center"
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
              disabled={isOptionsRefreshing}
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
      {/* Order summary: state what is being purchased, not only how to pay. */}
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {`OneKey Prime · ${intl.formatMessage({
            id:
              plan === 'yearly'
                ? ETranslations.prime_crypto_yearly_plan__title
                : ETranslations.prime_crypto_monthly_plan__title,
          })}`}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" maxWidth={720}>
          {intl.formatMessage({
            id: ETranslations.prime_crypto_manual_renewal__desc,
          })}
        </SizableText>
      </YStack>
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
          tokenSize="md"
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
          title={
            balanceErrorMessage ??
            intl.formatMessage({ id: ETranslations.global_failed })
          }
        />
      ) : null}

      {inlinePaymentErrorTitle ? (
        <Alert type="critical" title={inlinePaymentErrorTitle} />
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
  preferredNetworkId,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
  onPayWithExternalWallet: IPayWithExternalWallet;
  onClose: () => void;
  onExitPreventedChange: (isPrevented: boolean) => void;
  hasValidRouteParams: boolean;
  createNewPayment: boolean;
  preferredNetworkId?: string;
}) {
  const flowContextRef = useRef(useContext(PrimeInfiniPaymentFlowContext));
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
  // Bindings the content already worked with in this mount (created, refreshed
  // or broadcast here). Mid-flow loader re-runs must not bounce them back to
  // the existing-payment choice: right after a broadcast the server may not
  // report progress yet, and offering "start new payment" in that window is
  // exactly the duplicate-transfer risk the choice screen warns about.
  const [handledPaymentBindingIds, setHandledPaymentBindingIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const handlePaymentSessionPersisted = useCallback((bindingId: string) => {
    setHandledPaymentBindingIds((current) => {
      if (current.has(bindingId)) {
        return current;
      }
      const next = new Set(current);
      next.add(bindingId);
      return next;
    });
  }, []);
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
  const { purchase } = usePrimePurchaseCallback({
    networkId: preferredNetworkId,
  });
  const completedPaymentHandledRef = useRef('');
  const paymentCreationIntentRef = useRef(createNewPayment);
  const forcedReplacementGenerationRef = useRef(0);
  const paymentContextLoadAttemptRef = useRef(0);
  const pendingReloadRequestRef = useRef<
    IPrimeInfiniPaymentReloadRequest | undefined
  >(undefined);
  const paymentContextErrorToastLoadAttemptRef = useRef(0);
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
        ...flowContextRef.current,
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
      if (optionsResult.status === 'rejected') {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'paymentContext',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          isRetry: loadAttempt > 1,
          reason: 'paymentOptionsUnavailable',
          error: optionsResult.reason,
        });
      }
      if (purchaseStatusResult.status === 'rejected') {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'paymentContext',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          isRetry: loadAttempt > 1,
          reason: 'purchaseStatusUnavailable',
          error: purchaseStatusResult.reason,
        });
      }
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
      let sessionLoadError: unknown;
      let pendingSession: IPrimeInfiniPendingPaymentSession | undefined;
      let completedPaymentId: string | undefined;
      // Kept outside the try so a failed server refresh can still fall back to
      // what is stored locally.
      let localSessionSnapshot: IPrimeInfiniPendingPaymentSession | undefined;
      if (onekeyUserId) {
        try {
          const restoredSession = normalizePendingPaymentSession(
            await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession(
              { onekeyUserId, flowContext: flowContextRef.current },
            ),
          );
          localSessionSnapshot = restoredSession;
          if (restoredSession) {
            const canonicalAsset = getCanonicalPrimeInfiniPaymentAsset(
              restoredSession.asset,
            );
            if (!canonicalAsset) {
              sessionLoadFailed = true;
              sessionLoadError = new OneKeyLocalError(
                'Infini payment session asset is unavailable',
              );
            } else {
              const restoreResult = await resolvePrimeInfiniPaymentRestore({
                session: {
                  ...restoredSession,
                  asset: canonicalAsset,
                },
                supportedAssets,
                paymentOptionsLoaded: optionsResult.status === 'fulfilled',
                createNewPayment: shouldCreatePayment,
                flowId: flowContextRef.current?.flowId,
                requestedPlan: plan,
                requestedSubscriptionPeriod: selectedSubscriptionPeriod,
                fetchLatestPayment: (paymentId) =>
                  backgroundApiProxy.servicePrime.apiGetInfiniPayment({
                    flowContext: flowContextRef.current
                      ? {
                          ...flowContextRef.current,
                          paymentSource: 'restoreRefresh',
                        }
                      : undefined,
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
                        flowId: flowContextRef.current?.flowId,
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
          sessionLoadError = error;
          logPrimeInfiniPaymentFlow({
            ...flowContextRef.current,
            stage: 'paymentRestore',
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
      const infiniPeriodEnd = infiniSubscription?.currentPeriodEnd ?? 0;
      const freshBaseline = {
        onekeyUserId,
        wasPrimeActive,
        primeExpiresAt,
        infiniPeriodEnd,
        infiniSubscriptionId:
          infiniSubscription?.subscriptionId?.trim() || null,
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
      // Deliberately not gated on the payment creation intent: every entry
      // with a non-replaceable pending session pauses here once, resume
      // included, so the user always passes the one screen that can force a
      // new payment instead of being funneled straight into polling. Bindings
      // this mount already worked with are filtered out downstream via
      // handledPaymentBindingIds — a mid-flow loader re-run must not bounce a
      // just-broadcast payment back to this choice.
      const shouldShowExistingPaymentChoice = Boolean(
        pendingSession &&
        !isPrimeInfiniPaymentReplaceable({
          payment: pendingSession.payment,
          sendStarted: pendingSession.sendStarted,
        }),
      );
      // The server can keep failing on one specific invoice. Showing only the
      // retry screen would hide the unfinished-payment choice behind an error
      // the user cannot clear, which is the one screen that can release the
      // session. Fall back to the stored snapshot, clearly marked as stale.
      // Like the fresh choice above, this ignores the creation intent: a
      // resume entry whose load failed has nothing to resume into, so the
      // choice is the only screen that helps.
      const staleExistingPaymentSession =
        sessionLoadFailed &&
        localSessionSnapshot &&
        !isPrimeInfiniPaymentReplaceable({
          payment: localSessionSnapshot.payment,
          sendStarted: localSessionSnapshot.sendStarted,
        })
          ? localSessionSnapshot
          : undefined;
      if (pendingSession) {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
          stage: 'paymentRestore',
          status: 'restored',
          paymentSource: 'restoreRefresh',
          sessionAgeMs:
            Date.now() - (pendingSession.createdAt ?? pendingSession.updatedAt),
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
      if (sessionLoadError) {
        contextError = sessionLoadError;
      } else if (optionsResult.status === 'rejected') {
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
        ...flowContextRef.current,
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
      });
      return {
        loadAttempt,
        assets,
        baseline: freshBaseline,
        pendingSession,
        completedPaymentId,
        contextError,
        shouldCreatePayment,
        shouldShowExistingPaymentChoice,
        staleExistingPaymentSession,
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
  useEffect(() => {
    const pendingAssetKey = effectivePendingSession?.asset.key;
    if (pendingAssetKey) {
      setSelectedAssetKey((current) =>
        resolvePrimeInfiniPaymentPinnedAssetKey({
          selectedAssetKey: current,
          pendingAssetKey,
        }),
      );
    }
  }, [effectivePendingSession?.asset.key]);
  useEffect(() => {
    const request = pendingReloadRequestRef.current;
    if (!request || !result) {
      return;
    }
    const resolution = resolvePrimeInfiniPaymentReloadCommit({
      request,
      committedLoadAttempt: result.loadAttempt,
      committedBindingId: effectivePendingSession?.paymentCacheKey.bindingId,
    });
    if (resolution === 'wait') {
      return;
    }
    pendingReloadRequestRef.current = undefined;
    if (resolution === 'remount') {
      setPaymentSessionGeneration((value) => value + 1);
    }
  }, [effectivePendingSession?.paymentCacheKey.bindingId, result]);
  useEffect(() => {
    if (
      !result?.hasError ||
      !result.contextError ||
      paymentContextErrorToastLoadAttemptRef.current >= result.loadAttempt
    ) {
      return;
    }
    paymentContextErrorToastLoadAttemptRef.current = result.loadAttempt;
    showPrimeInfiniPaymentErrorToast({
      error: result.contextError,
      fallbackMessage: intl.formatMessage({
        id: ETranslations.global_failed,
      }),
    });
  }, [intl, result]);
  const freshExistingPaymentChoiceSession =
    result?.shouldShowExistingPaymentChoice &&
    effectivePendingSession &&
    !handledPaymentBindingIds.has(
      effectivePendingSession.paymentCacheKey.bindingId,
    ) &&
    continuedExistingPaymentBindingId !==
      effectivePendingSession.paymentCacheKey.bindingId
      ? effectivePendingSession
      : undefined;
  const staleExistingPaymentChoiceSession =
    !freshExistingPaymentChoiceSession &&
    result?.staleExistingPaymentSession &&
    !discardedPaymentBindingIds.has(
      result.staleExistingPaymentSession.paymentCacheKey.bindingId,
    ) &&
    !handledPaymentBindingIds.has(
      result.staleExistingPaymentSession.paymentCacheKey.bindingId,
    ) &&
    continuedExistingPaymentBindingId !==
      result.staleExistingPaymentSession.paymentCacheKey.bindingId
      ? result.staleExistingPaymentSession
      : undefined;
  const existingPaymentChoiceSession =
    freshExistingPaymentChoiceSession ?? staleExistingPaymentChoiceSession;

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
      ...flowContextRef.current,
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
        ...flowContextRef.current,
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
        ...flowContextRef.current,
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
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
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
      resolvePrimeInfiniPaymentAsset({
        assets: result?.assets ?? [],
        selectedAssetKey,
        pendingAssetKey: effectivePendingSession?.asset.key,
        preferredNetworkId,
      }),
    [
      effectivePendingSession?.asset.key,
      preferredNetworkId,
      result?.assets,
      selectedAssetKey,
    ],
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
  const handlePaymentContextRunError = useCallback(
    (error: unknown, reason: string) => {
      logPrimeInfiniPaymentFlow({
        ...flowContextRef.current,
        stage: 'paymentSession',
        status: 'failed',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
        reason,
        error,
      });
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    },
    [featureName, intl, plan, selectedSubscriptionPeriod],
  );
  const handleDiscardPaymentSession = useCallback(
    (bindingId: string) => {
      paymentCreationIntentRef.current = true;
      setDiscardedPaymentBindingIds((current) => {
        return addPrimeInfiniDiscardedPaymentBindingId(current, bindingId);
      });
      setPaymentSessionGeneration((value) => value + 1);
      void run({ alwaysSetState: true }).catch((error) => {
        handlePaymentContextRunError(error, 'discardedSessionReloadFailed');
      });
    },
    [handlePaymentContextRunError, run],
  );
  const handleReplacePaymentSession = useCallback(
    ({ bindingId, assetKey }: { bindingId: string; assetKey: string }) => {
      paymentCreationIntentRef.current = true;
      setSelectedAssetKey(assetKey);
      setDiscardedPaymentBindingIds((current) => {
        return addPrimeInfiniDiscardedPaymentBindingId(current, bindingId);
      });
      setPaymentSessionGeneration((value) => value + 1);
      void run({ alwaysSetState: true }).catch((error) => {
        handlePaymentContextRunError(error, 'replacedSessionReloadFailed');
      });
    },
    [handlePaymentContextRunError, run],
  );
  const handleReloadPaymentSession = useCallback(() => {
    if (pendingReloadRequestRef.current) {
      return;
    }
    const request: IPrimeInfiniPaymentReloadRequest = {
      minimumLoadAttempt: paymentContextLoadAttemptRef.current + 1,
      previousBindingId: effectivePendingSession?.paymentCacheKey.bindingId,
    };
    pendingReloadRequestRef.current = request;
    void run({ alwaysSetState: true }).catch((error) => {
      if (pendingReloadRequestRef.current === request) {
        pendingReloadRequestRef.current = undefined;
      }
      handlePaymentContextRunError(error, 'sessionReloadFailed');
    });
  }, [
    effectivePendingSession?.paymentCacheKey.bindingId,
    handlePaymentContextRunError,
    run,
  ]);
  const handleRestartPaymentSession = useCallback(() => {
    paymentCreationIntentRef.current = true;
    setPaymentSessionGeneration((value) => value + 1);
    void run({ alwaysSetState: true }).catch((error) => {
      handlePaymentContextRunError(error, 'restartedSessionReloadFailed');
    });
  }, [handlePaymentContextRunError, run]);
  const handleContinueExistingPayment = useCallback(() => {
    if (!existingPaymentChoiceSession) {
      return;
    }
    logPrimeInfiniPaymentFlow({
      ...flowContextRef.current,
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
    if (staleExistingPaymentChoiceSession) {
      // This choice was rendered from the stored snapshot because the server
      // would not confirm the invoice, so there is nothing to resume into:
      // polling needs the same request that just failed. Marking it continued
      // would also hide the forced replacement along with the screen, leaving
      // no way back to it. Retry the load instead, which either recovers the
      // real session or brings both options back.
      void run({ alwaysSetState: true }).catch((error) => {
        handlePaymentContextRunError(error, 'staleSessionReloadFailed');
      });
      return;
    }
    setContinuedExistingPaymentBindingId(
      existingPaymentChoiceSession.paymentCacheKey.bindingId,
    );
  }, [
    existingPaymentChoiceSession,
    featureName,
    handlePaymentContextRunError,
    plan,
    run,
    selectedSubscriptionPeriod,
    staleExistingPaymentChoiceSession,
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
    let handedOffToPaymentEntry = false;
    setIsStartingForcedReplacement(true);
    onExitPreventedChange(true);
    logPrimeInfiniPaymentFlow({
      ...flowContextRef.current,
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
              flowContext: flowContextRef.current,
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
          onLatestPaymentUnavailable: (error) => {
            logPrimeInfiniPaymentFlow({
              ...flowContextRef.current,
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
              reason: 'forcedReplacementInvoiceUnavailable',
              sendStarted: currentSession.sendStarted,
              error,
            });
          },
          shouldContinue,
        });
      if (!shouldContinue() || replacementResult.type === 'cancelled') {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
          ...flowContextRef.current,
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
        setIsStartingForcedReplacement(false);
        onExitPreventedChange(false);
        handedOffToPaymentEntry = true;
        // The superseded session no longer holds the entry gate, so hand the
        // user back to the payment method picker rather than silently minting
        // another invoice for the same token. Someone forcing a new payment may
        // be doing it precisely because they can no longer pay with that asset,
        // and having accepted the duplicate-transfer warning they are entitled
        // to every channel, not just the crypto one.
        onClose();
        if (platformEnv.isNative) {
          await timerUtils.wait(PRIME_PAYMENT_MODAL_CLOSE_DELAY_MS);
        }
        await purchase({ selectedSubscriptionPeriod, featureName });
        return;
      }
      if (replacementResult.type === 'track') {
        logPrimeInfiniPaymentFlow({
          ...flowContextRef.current,
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
        ...flowContextRef.current,
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
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    } finally {
      if (!handedOffToPaymentEntry) {
        setIsStartingForcedReplacement(false);
        onExitPreventedChange(false);
      }
    }
  }, [
    existingPaymentChoiceSession,
    featureName,
    isStartingForcedReplacement,
    intl,
    onClose,
    onExitPreventedChange,
    purchase,
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
        flowId: flowContextRef.current?.flowId,
        selectedSubscriptionPeriod,
        featureName,
      });
      if (!didOpenCheckout) {
        return;
      }
      shouldRestoreExit = false;
      onClose();
    } catch (error) {
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    } finally {
      if (shouldRestoreExit) {
        onExitPreventedChange(false);
        setIsErrorExternalCheckoutPending(false);
      }
    }
  }, [
    featureName,
    intl,
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
          isPaymentStateStale={Boolean(staleExistingPaymentChoiceSession)}
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
      paymentContextErrorTitle = intl.formatMessage({
        id: ETranslations.prime_payment_start_failed__msg,
      });
    } else if (!result.baseline.onekeyUserId) {
      paymentContextErrorTitle = intl.formatMessage({
        id: ETranslations.prime_not_logged_in_description,
      });
    } else if (result.hasError) {
      paymentContextErrorTitle = intl.formatMessage({
        id: ETranslations.global_failed,
      });
    }
    if (!selectedAsset || !availableNetworksMap) {
      return (
        <PrimeInfiniPaymentUnavailableSelection
          errorTitle={
            paymentContextErrorTitle ??
            intl.formatMessage({
              id: ETranslations.global_failed,
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
        onPaymentSessionPersisted={handlePaymentSessionPersisted}
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
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<IPrimeParamList>>();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeInfiniPayment>();
  const [flowContext] = useState<IPrimeInfiniPaymentFlowContext>(() => ({
    flowId: route.params?.flowId ?? generateUUID(),
    createNewPaymentIntent: route.params?.createNewPayment === true,
  }));
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
      title: intl.formatMessage({
        id: ETranslations.prime_crypto_payment_unsupported__msg,
      }),
    });
    closePaymentPage();
  }, [closePaymentPage, intl, isCryptoPaymentSupported]);

  return (
    <PrimeInfiniPaymentFlowContext.Provider value={flowContext}>
      <Page testID="prime-infini-payment-page" scrollEnabled>
        <Page.Header
          headerTitle={intl.formatMessage({
            id: ETranslations.prime_pay_with_crypto__title,
          })}
        />
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
                preferredNetworkId={route.params?.networkId}
              />
            ) : (
              <Stack alignItems="center" py="$6">
                <Spinner size="large" />
              </Stack>
            )}
          </YStack>
        </Page.Body>
      </Page>
    </PrimeInfiniPaymentFlowContext.Provider>
  );
}
