/* cspell:ignore Infini */
import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeInfiniSubscription } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimePurchaseCallback } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { PrimeTestIDs } from '../../testIDs';
import { isInfiniSubscriptionInPeriod } from '../PrimeInfiniSubscription/infiniSubscriptionUtils';

// Crypto pay is not available on iOS / Android Google Play builds (store
// policy, integration plan §2), so those builds must not surface the Infini
// management entry either (plan §10 regression criterion): skip the Infini
// lookup entirely and keep the original RevenueCat manage-url behavior.
const isInfiniManageSupported =
  !platformEnv.isNativeIOS && !platformEnv.isNativeAndroidGooglePlay;

// Upper bound for awaiting an in-flight Infini lookup inside the click
// handler: on web, window.open must run within the click's transient user
// activation (~5s in Chromium) or the popup blocker silently eats it.
const INFINI_LOOKUP_CLICK_TIMEOUT_MS = 3000;

function PrimeUserInfoMoreButtonDropDownMenu({
  handleActionListClose,
  onBeforeLogout,
  onLogoutSuccess,
}: {
  handleActionListClose: () => void;
  onBeforeLogout?: () => void;
  onLogoutSuccess?: () => Promise<void>;
}) {
  const { user } = useOneKeyAuth();
  const isPrime = user?.primeSubscription?.isActive;
  const primeExpiredAt = user?.primeSubscription?.expiresAt;
  const subscriptionManageUrl = user?.subscriptionManageUrl;
  const { getCustomerInfo } = usePrimePayment();
  const [devSettings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const { purchase } = usePrimePurchaseCallback();
  const navigation = useAppNavigation();

  // Prefetched when the dropdown opens so the Manage-subscription click can
  // usually resolve the channel routing instantly (integration plan §5.3(d));
  // the promise ref lets an early click await the in-flight lookup instead of
  // racing the reactive result. The result is wrapped in an object so that
  // "settled with no Infini subscription" can be told apart from "still
  // loading" (both would otherwise be a plain undefined).
  const infiniSubscriptionPromiseRef = useRef<
    Promise<IPrimeInfiniSubscription | undefined> | undefined
  >(undefined);
  const { result: infiniLookup } = usePromiseResult(async () => {
    if (!isPrime || !isInfiniManageSupported) {
      infiniSubscriptionPromiseRef.current = undefined;
      return { subscription: undefined };
    }
    // Lookup failures fall back to the original RevenueCat manage url flow,
    // so RevenueCat-only users see zero behavior change
    const promise = backgroundApiProxy.servicePrime
      .apiGetInfiniSubscription()
      .catch(() => undefined);
    infiniSubscriptionPromiseRef.current = promise;
    return { subscription: await promise };
  }, [isPrime]);
  const infiniSubscription = infiniLookup?.subscription;

  const handleManageSubscription = useCallback(async () => {
    let latestInfiniSubscription = infiniLookup?.subscription;
    if (!infiniLookup) {
      // The prefetch has not settled yet: await it, but bounded — on web the
      // fallback openUrlExternal below is window.open, which must run within
      // the click's transient user activation or the popup blocker silently
      // eats it. On timeout fall back to the RevenueCat manage url, matching
      // the pre-Infini behavior.
      latestInfiniSubscription = await Promise.race([
        infiniSubscriptionPromiseRef.current ?? Promise.resolve(undefined),
        timerUtils.wait(INFINI_LOOKUP_CLICK_TIMEOUT_MS).then(() => undefined),
      ]);
    }
    // Infini takes priority while its paid period has not ended, including
    // canceled-but-not-expired subscriptions (integration plan §5.3(d))
    if (isInfiniSubscriptionInPeriod(latestInfiniSubscription)) {
      navigation.push(EPrimePages.PrimeInfiniSubscription);
      return;
    }
    if (subscriptionManageUrl) {
      openUrlUtils.openUrlExternal(subscriptionManageUrl);
    }
  }, [infiniLookup, navigation, subscriptionManageUrl]);

  const refreshUserInfo = useCallback(async () => {
    void getCustomerInfo();
    void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
  }, [getCustomerInfo]);

  useEffect(() => {
    if (isPrime && !subscriptionManageUrl) {
      void refreshUserInfo();
    }
  }, [isPrime, refreshUserInfo, subscriptionManageUrl]);

  const handleLogout = useConfirmOneKeyIdLogout({
    reason: 'PrimeUserInfoMoreButton Logout Button',
    onBeforeLogout,
    onSuccess: onLogoutSuccess,
  });

  const userInfoView = (
    <Stack px="$2" py="$2.5" gap="$1">
      <XStack alignItems="center" gap="$2">
        <MultipleClickStack
          flex={1}
          onPress={async () => {
            handleActionListClose();
            const sdkCustomerInfo = await getCustomerInfo();
            const serverPrimeUserInfo =
              await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
            const result = {
              user,
              sdkCustomerInfo,
              serverPrimeUserInfo,
            };
            console.log(result);
            Dialog.debugMessage({
              title: 'sdkCustomerInfo',
              debugMessage: result,
            });
          }}
        >
          <SizableText flex={1} size="$headingSm">
            {getDisplayEmailOrUnknown({
              intl,
              displayEmail: user?.displayEmail,
            })}
          </SizableText>
        </MultipleClickStack>
      </XStack>
      {primeExpiredAt && isPrime ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.prime_end_date,
            },
            {
              // "prime.end_date": "Ends on {data}",
              data: formatDateFns(new Date(primeExpiredAt)),
            },
          )}
        </SizableText>
      ) : null}
    </Stack>
  );
  return (
    <>
      {userInfoView}

      {/*
       Sometimes, the local payment is successful (for example, sandbox payment), but the server status is incorrect, so even if the subscriptionManageUrl exists, you need to expose the management subscription entry to allow the user to cancel the subscription
      */}
      {isPrime &&
      (subscriptionManageUrl ||
        isInfiniSubscriptionInPeriod(infiniSubscription)) ? (
        <ActionList.Item
          label={intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
          icon="CreditCardOutline"
          onClose={handleActionListClose}
          onPress={async () => {
            await handleManageSubscription();
          }}
        />
      ) : null}

      {isPrime ? (
        <>
          {devSettings?.enabled ? (
            <ActionList.Item
              label="Change Subscription (DevOnly)"
              icon="CreditCardOutline"
              onClose={handleActionListClose}
              onPress={async () => {
                void purchase({
                  selectedSubscriptionPeriod: 'P1Y',
                });
              }}
            />
          ) : null}
        </>
      ) : null}

      <ActionList.Item
        label={intl.formatMessage({
          id: ETranslations.prime_log_out,
        })}
        icon="LogoutOutline"
        onClose={handleActionListClose}
        onPress={handleLogout}
      />
    </>
  );
}

export function PrimeUserInfoMoreButton({
  onBeforeLogout,
  onLogoutSuccess,
}: {
  onBeforeLogout?: () => void;
  onLogoutSuccess?: () => Promise<void>;
}) {
  const renderItems = useCallback(
    ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
      handleActionListOpen: () => void;
    }) => (
      <PrimeUserInfoMoreButtonDropDownMenu
        handleActionListClose={handleActionListClose}
        onBeforeLogout={onBeforeLogout}
        onLogoutSuccess={onLogoutSuccess}
      />
    ),
    [onBeforeLogout, onLogoutSuccess],
  );
  return (
    <ActionList
      title="OneKey ID"
      floatingPanelProps={{
        w: '$80',
      }}
      renderItems={renderItems}
      renderTrigger={
        <IconButton
          testID={PrimeTestIDs.userInfoMoreBtn}
          icon="DotHorOutline"
          variant="tertiary"
          size="small"
        />
      }
    />
  );
}
