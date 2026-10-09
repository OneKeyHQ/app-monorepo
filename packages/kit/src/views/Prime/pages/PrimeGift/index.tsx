import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  NavCloseButton,
  Page,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isNotificationFullyEnabled } from '@onekeyhq/kit/src/utils/notificationPermissionUtils';
import { enterWalletAfterOnboarding } from '@onekeyhq/kit/src/views/Onboardingv2/utils/enterWalletAfterOnboarding';
import { usePrimeGiftKyt } from '@onekeyhq/kit/src/views/Setting/pages/Protection/usePrimeGiftKyt';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EPrimeGiftPages,
  IPrimeGiftParamList,
} from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import {
  PrimeGiftClaimView,
  PrimeGiftSuccessView,
} from '../../components/PrimeGiftViews';
import { getPrimeGiftDurationText } from '../../hooks/primeGiftDuration';
import { resolvePrimeGiftPrimaryAction } from '../../hooks/primeGiftPrimaryAction';
import { usePrimeGiftClaim } from '../../hooks/usePrimeGiftClaim';
import { usePrimeGiftReasonMessage } from '../../hooks/usePrimeGiftMessages';

function PrimeGiftPageHeader({
  headerShown,
  onClose,
  useOnboardingSafeAreaClose,
}: {
  headerShown: boolean;
  onClose: () => void;
  useOnboardingSafeAreaClose: boolean;
}) {
  const { top } = useSafeAreaInsets();
  const renderHeaderLeft = useCallback(
    () => <NavCloseButton onPress={onClose} />,
    [onClose],
  );
  if (useOnboardingSafeAreaClose) {
    return (
      <>
        <Page.Header headerShown={false} />
        {headerShown ? (
          <XStack
            pt={top}
            px="$5"
            h={top + 52}
            flexShrink={0}
            alignItems="center"
          >
            <NavCloseButton onPress={onClose} />
          </XStack>
        ) : null}
      </>
    );
  }
  return (
    <Page.Header
      headerShown={headerShown}
      headerTitle=""
      headerLeft={renderHeaderLeft}
    />
  );
}

function Success({
  result,
  confirmLabel,
  onConfirm,
}: {
  result: IPrimeGiftClaimResult;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const { isEnabled, isLoading, open } = usePrimeGiftKyt({
    expectedOneKeyUserId: result.onekeyUserId,
  });
  const [{ lastSettingsUpdateTime }] = useNotificationsAtom();
  const { result: isNotificationEnabled } = usePromiseResult(
    async () => isEnabled && isNotificationFullyEnabled(),
    // Settings changes invalidate the permission read even while this page stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEnabled, lastSettingsUpdateTime],
    { initResult: false, revalidateOnFocus: true },
  );
  return (
    <PrimeGiftSuccessView
      result={result}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      isKytEnabled={isEnabled}
      isKytLoading={isLoading}
      isNotificationEnabled={isNotificationEnabled}
      onKyt={() => {
        void open();
      }}
    />
  );
}

export default function PrimeGiftPage() {
  const intl = useIntl();
  const { params } = useAppRoute<
    IPrimeGiftParamList,
    EPrimeGiftPages.PrimeGift
  >();
  const navigation = useAppNavigation();
  const reasonMessage = usePrimeGiftReasonMessage();
  const claim = usePrimeGiftClaim(params);
  const closePage = useCallback(() => {
    navigation.pop();
  }, [navigation]);
  const enterWallet = useCallback(async () => {
    if (params.source === 'onboarding') {
      if (params.onboardingRouteKey) {
        const handled = await enterWalletAfterOnboarding(
          params.onboardingRouteKey,
          async () => {
            navigation.pop();
            await timerUtils.wait(600);
          },
        );
        if (handled) return;
      }
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    }
    await navigation.switchTabAsync(ETabRoutes.Home);
  }, [navigation, params.source, params.onboardingRouteKey]);
  const verification = claim.verification;
  const isAlreadyRedeemed = verification?.status === 'redeemed';
  const isEligible = Boolean(verification?.hasCode && !isAlreadyRedeemed);
  let eligibilityStatus = intl.formatMessage({
    id: ETranslations.prime_gift_eligibility_pending__desc,
  });
  if (isAlreadyRedeemed) {
    eligibilityStatus = intl.formatMessage({ id: ETranslations.earn_claimed });
  } else if (verification) {
    eligibilityStatus = intl.formatMessage({
      id: isEligible
        ? ETranslations.prime_gift_code_received__desc
        : ETranslations.prime_gift_no_code__desc,
    });
  }
  const giftDuration = getPrimeGiftDurationText(claim.eligibility ?? {}, intl);
  const successFromOnboarding = params.source === 'onboarding';
  const successConfirmLabel = intl.formatMessage({
    id: successFromOnboarding
      ? ETranslations.enter_wallet
      : ETranslations.global_done,
  });
  const primary = resolvePrimeGiftPrimaryAction({
    isQuerying: claim.isQuerying,
    isLoggedIn: claim.isLoggedIn,
    isPendingPaymentConfirm: claim.isPendingPaymentConfirm,
    hasClaimableCode: Boolean(claim.code),
    isAlreadyRedeemed,
    hasVerificationWithoutCode: Boolean(
      verification && !verification.hasCode && !isAlreadyRedeemed,
    ),
    hasError: Boolean(claim.error),
    giftDuration,
  });
  const primaryLabel = intl.formatMessage(
    { id: primary.labelId },
    primary.labelValues,
  );
  const trackCode = useCallback(
    (status: 'view' | 'copy') => {
      defaultLogger.prime.subscription.primeGiftStage({
        source: params.source,
        stage: 'code',
        status,
      });
    },
    [params.source],
  );
  return (
    <Page backgroundColor="$bgApp">
      <PrimeGiftPageHeader
        headerShown={!claim.result}
        onClose={closePage}
        useOnboardingSafeAreaClose={Boolean(
          platformEnv.isNativeAndroid && params.source === 'onboarding',
        )}
      />
      <Page.Body>
        {claim.result ? (
          <Success
            result={claim.result}
            confirmLabel={successConfirmLabel}
            onConfirm={() => {
              if (successFromOnboarding) void enterWallet();
              else closePage();
            }}
          />
        ) : (
          <PrimeGiftClaimView
            deviceModelName={
              deviceUtils.getDeviceModelNameByType(params.device.deviceType) ||
              'OneKey'
            }
            giftMonths={claim.eligibility?.giftMonths}
            giftDays={claim.eligibility?.giftDays}
            eligibilityStatus={eligibilityStatus}
            isEligible={isEligible}
            accountName={
              claim.isLoggedIn
                ? claim.user?.displayEmail ||
                  claim.user?.email ||
                  claim.onekeyUserId
                : undefined
            }
            isAccountReady={claim.isLoggedIn}
            isDeviceVerified={claim.deviceVerified}
            redemptionCode={claim.code}
            onViewCode={() => {
              trackCode('view');
            }}
            onCopyCode={() => {
              trackCode('copy');
            }}
            isPendingPaymentConfirm={claim.isPendingPaymentConfirm}
            error={reasonMessage(claim.error)}
            primaryLabel={primaryLabel}
            isProcessing={claim.isSubmitting || claim.isQuerying}
            onSubmit={() => {
              if (primary.action === 'login') void claim.login();
              else if (primary.action === 'claim') void claim.claim();
              else if (primary.action === 'close') closePage();
              else void claim.submit();
            }}
          />
        )}
      </Page.Body>
    </Page>
  );
}
