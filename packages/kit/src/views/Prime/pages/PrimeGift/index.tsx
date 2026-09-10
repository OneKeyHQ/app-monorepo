import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isNotificationFullyEnabled } from '@onekeyhq/kit/src/utils/notificationPermissionUtils';
import { enterWalletAfterOnboarding } from '@onekeyhq/kit/src/views/Onboardingv2/utils/enterWalletAfterOnboarding';
import { usePrimeGiftKyt } from '@onekeyhq/kit/src/views/Setting/pages/Protection/usePrimeGiftKyt';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import {
  PrimeGiftClaimView,
  PrimeGiftSuccessView,
} from '../../components/PrimeGiftViews';
import { getPrimeGiftDurationText } from '../../hooks/primeGiftDuration';
import { usePrimeGiftClaim } from '../../hooks/usePrimeGiftClaim';
import { usePrimeGiftReasonMessage } from '../../hooks/usePrimeGiftMessages';

function Success({
  result,
  onEnterWallet,
}: {
  result: IPrimeGiftClaimResult;
  onEnterWallet: () => void;
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
      onEnterWallet={onEnterWallet}
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
  const { params } = useAppRoute<IPrimeParamList, EPrimePages.PrimeGift>();
  const navigation = useAppNavigation();
  const reasonMessage = usePrimeGiftReasonMessage();
  const claim = usePrimeGiftClaim(params);
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
  let primaryLabel = intl.formatMessage({
    id: claim.deviceVerified
      ? ETranslations.prime_gift__title
      : ETranslations.prime_gift_verify_and_claim__action,
  });
  const giftDuration = getPrimeGiftDurationText(claim.eligibility ?? {}, intl);
  if (claim.deviceVerified && giftDuration) {
    primaryLabel = intl.formatMessage(
      { id: ETranslations.prime_gift_claim_duration__action },
      { duration: giftDuration },
    );
  }
  if (claim.isQuerying)
    primaryLabel = intl.formatMessage({
      id: ETranslations.prime_gift_checking_login__desc,
    });
  else if (!claim.isLoggedIn)
    primaryLabel = intl.formatMessage({
      id: ETranslations.prime_gift_login__action,
    });
  else if (claim.error)
    primaryLabel = intl.formatMessage({
      id: claim.deviceVerified
        ? ETranslations.prime_gift_retry_claim__action
        : ETranslations.prime_gift_retry_verify__action,
    });
  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        {claim.result ? (
          <Success
            result={claim.result}
            onEnterWallet={() => {
              void enterWallet();
            }}
          />
        ) : (
          <PrimeGiftClaimView
            onBack={() => navigation.pop()}
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
            error={reasonMessage(claim.error)}
            primaryLabel={primaryLabel}
            isProcessing={claim.isSubmitting || claim.isQuerying}
            onSubmit={() => {
              if (!claim.isLoggedIn) void claim.login();
              else void claim.submit();
            }}
          />
        )}
      </Page.Body>
    </Page>
  );
}
