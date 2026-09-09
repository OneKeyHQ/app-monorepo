import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePrimeGiftKyt } from '@onekeyhq/kit/src/views/Setting/pages/Protection/usePrimeGiftKyt';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import {
  PrimeGiftClaimContent,
  PrimeGiftSuccessContent,
} from '../../components/PrimeGiftViews';
import { usePrimeGiftClaim } from '../../hooks/usePrimeGiftClaim';
import {
  usePrimeGiftMessages,
  usePrimeGiftReasonMessage,
} from '../../hooks/usePrimeGiftMessages';

function Success({ result }: { result: IPrimeGiftClaimResult }) {
  const { isEnabled, isLoading, open } = usePrimeGiftKyt({
    expectedOneKeyUserId: result.onekeyUserId,
  });
  return (
    <PrimeGiftSuccessContent
      result={result}
      isKytEnabled={isEnabled}
      isKytLoading={isLoading}
      onKyt={() => {
        void open();
      }}
    />
  );
}

export default function PrimeGiftPage() {
  const { params } = useAppRoute<IPrimeParamList, EPrimePages.PrimeGift>();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const message = usePrimeGiftMessages();
  const reasonMessage = usePrimeGiftReasonMessage();
  const claim = usePrimeGiftClaim(params);
  const enterWallet = useCallback(async () => {
    if (params.source === 'onboarding') {
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    }
    await navigation.switchTabAsync(ETabRoutes.Home);
  }, [navigation, params.source]);
  let eligibilityStatus = message(ETranslationsMock.prime_gift_unavailable);
  if (claim.isQuerying)
    eligibilityStatus = message(ETranslationsMock.prime_gift_loading);
  else if (claim.eligibility?.reason)
    eligibilityStatus =
      reasonMessage(claim.eligibility.reason) || eligibilityStatus;
  else if (claim.eligibility?.status === 'redeemed')
    eligibilityStatus = message(ETranslationsMock.prime_gift_claimed);
  else if (claim.eligibility?.canClaim)
    eligibilityStatus = message(ETranslationsMock.prime_gift_eligible);
  const canRetryQuery = Boolean(
    claim.error ||
    claim.accountEligibility?.reason === 'account_eligibility_unavailable' ||
    claim.accountEligibility?.reason === 'account_changed',
  );
  let primaryLabel = claim.deviceVerified
    ? message(ETranslationsMock.prime_gift_claim, {
        count: claim.eligibility?.giftMonths || 0,
      })
    : message(ETranslationsMock.prime_gift_verify_claim);
  if (canRetryQuery) primaryLabel = message(ETranslationsMock.prime_gift_retry);
  else if (!claim.isLoggedIn)
    primaryLabel = message(ETranslationsMock.prime_gift_login);
  const blocked =
    !canRetryQuery &&
    (!claim.eligibility?.canClaim ||
      (claim.isLoggedIn && !claim.accountEligibility?.canClaim));
  return (
    <Page
      scrollEnabled
      scrollProps={{ contentContainerStyle: { flexGrow: 1 } }}
    >
      <Page.Header title={message(ETranslationsMock.prime_gift_title)} />
      <Page.Body>
        {claim.result ? (
          <Success result={claim.result} />
        ) : (
          <PrimeGiftClaimContent
            giftMonths={claim.eligibility?.giftMonths}
            eligibilityStatus={eligibilityStatus}
            isEligible={Boolean(
              claim.eligibility?.canClaim && !claim.isQuerying,
            )}
            accountName={
              claim.isLoggedIn
                ? claim.user?.displayEmail ||
                  claim.user?.email ||
                  claim.user?.onekeyUserId
                : undefined
            }
            isAccountReady={Boolean(
              claim.isLoggedIn && claim.accountEligibility?.canClaim,
            )}
            isProcessing={claim.isSubmitting && claim.isLoggedIn}
            isDeviceVerified={claim.deviceVerified}
            error={reasonMessage(
              claim.error || claim.accountEligibility?.reason,
            )}
            onAccount={
              claim.isLoggedIn && !claim.isSubmitting
                ? () => navigation.push(EPrimePages.OneKeyId)
                : undefined
            }
          />
        )}
      </Page.Body>
      <Page.Footer>
        <YStack px="$5" pt="$3" pb="$5" gap="$3">
          {claim.result ? null : (
            <>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                textAlign="center"
              >
                {message(ETranslationsMock.prime_gift_once)}
              </SizableText>
              <Button
                size="large"
                variant="primary"
                loading={claim.isSubmitting || claim.isQuerying}
                disabled={claim.isSubmitting || claim.isQuerying || blocked}
                testID="pro2-prime-claim-primary"
                onPress={() => {
                  if (canRetryQuery) void claim.refresh();
                  else if (!claim.isLoggedIn) void claim.login();
                  else void claim.submit();
                }}
              >
                {primaryLabel}
              </Button>
            </>
          )}
          <Button
            size="large"
            variant={claim.result ? 'primary' : 'tertiary'}
            testID="pro2-prime-enter-wallet"
            onPress={enterWallet}
          >
            {intl.formatMessage({ id: ETranslations.enter_wallet })}
          </Button>
        </YStack>
      </Page.Footer>
    </Page>
  );
}
