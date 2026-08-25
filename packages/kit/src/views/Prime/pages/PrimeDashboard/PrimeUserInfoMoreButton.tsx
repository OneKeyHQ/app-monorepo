/* cspell:ignore Infini */
import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePrimePurchaseCallback } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { PrimeTestIDs } from '../../testIDs';

import { showPrimeRedemptionDialog } from './PrimeRedemptionDialog';
import {
  getPrimeSubscriptionManagementTarget,
  resolvePrimeSubscriptionManagementTarget,
} from './primeSubscriptionManagementUtils';

// Crypto pay is not available on iOS / Android Google Play builds (store
// policy, integration plan §2), so those builds must not surface the Infini
// management entry either (plan §10 regression criterion): skip the Infini
// lookup entirely and keep the original RevenueCat manage-url behavior.
const isInfiniManageSupported =
  !platformEnv.isNativeIOS && !platformEnv.isNativeAndroidGooglePlay;

// Grace period before the loading dialog appears: waits that resolve faster
// than this stay dialog-free, so an (almost) settled lookup never flashes a
// loading frame.
const LOADING_DIALOG_DELAY_MS = 150;

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
  const primeSubscription = user?.primeSubscription;
  const isPrime = primeSubscription?.isActive;
  const primeExpiredAt = primeSubscription?.expiresAt;
  const subscriptionManageUrl = user?.subscriptionManageUrl;
  const currentOneKeyUserId = user?.onekeyUserId;
  const { getCustomerInfo } = usePrimePayment();
  const [devSettings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const { purchase } = usePrimePurchaseCallback();
  const navigation = useAppNavigation();

  const handleManageSubscription = useCallback(async () => {
    const currentUserInfo = {
      primeSubscription,
      subscriptionManageUrl,
    };
    const currentTarget = getPrimeSubscriptionManagementTarget({
      userInfo: currentUserInfo,
      isInfiniManageSupported,
    });
    const openTarget = (
      target: ReturnType<typeof getPrimeSubscriptionManagementTarget>,
    ) => {
      if (target.type === 'infini') {
        defaultLogger.prime.subscription.primeManageSubscriptionClick({
          target: 'infiniPage',
        });
        navigation.push(EPrimePages.PrimeInfiniSubscription);
        return true;
      }
      if (target.type === 'external') {
        defaultLogger.prime.subscription.primeManageSubscriptionClick({
          target: 'externalUrl',
        });
        openUrlUtils.openUrlExternal(target.url);
        return true;
      }
      return false;
    };
    if (openTarget(currentTarget)) {
      return;
    }

    let loadingDialog: IDialogInstance | undefined;
    const loadingTimerId = setTimeout(() => {
      loadingDialog = Dialog.loading({
        title: intl.formatMessage({ id: ETranslations.global_preparing }),
      });
    }, LOADING_DIALOG_DELAY_MS);
    try {
      const resolvedTarget = await resolvePrimeSubscriptionManagementTarget({
        currentUserInfo,
        isInfiniManageSupported,
        fetchFreshUserInfo: async () => {
          const { userInfo } =
            await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
          return userInfo;
        },
        fetchInfiniSubscription: async () => {
          if (!currentOneKeyUserId) {
            return undefined;
          }
          return backgroundApiProxy.servicePrime.apiGetInfiniSubscription({
            expectedOneKeyUserId: currentOneKeyUserId,
          });
        },
      });
      if (openTarget(resolvedTarget)) {
        return;
      }
      defaultLogger.prime.subscription.primeManageSubscriptionClick({
        target: 'unresolved',
      });
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.prime_manage_subscription,
        }),
        // TODO: Replace with subscription_management_channel_unavailable__msg
        // after the key is added to Lokalise and translations are pulled.
        message:
          'Unable to manage this subscription because its channel is missing or unsupported, and no management URL was provided.',
      });
    } catch (error) {
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
    } finally {
      // Clear the pending timer first: a refresh that resolved inside the
      // grace period would otherwise still pop the dialog afterwards, with
      // nothing left to close it.
      clearTimeout(loadingTimerId);
      void loadingDialog?.close();
    }
  }, [
    currentOneKeyUserId,
    intl,
    navigation,
    primeSubscription,
    subscriptionManageUrl,
  ]);

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

      <ActionList.Item
        testID={PrimeTestIDs.redemptionMenuItem}
        label={intl.formatMessage({
          id: ETranslations.prime_redeem__action,
        })}
        icon="TicketOutline"
        onClose={handleActionListClose}
        onPress={async (close) => {
          close();
          if (currentOneKeyUserId) {
            const isPrimeActiveBeforeRedeem = Boolean(isPrime);
            defaultLogger.prime.subscription.primeRedemptionEntryClick({
              isPrimeActiveBeforeRedeem,
            });
            if (platformEnv.isNative) {
              await timerUtils.wait(500);
            }
            showPrimeRedemptionDialog({
              expectedOneKeyUserId: currentOneKeyUserId,
              isPrimeActiveBeforeRedeem,
            });
          }
        }}
      />

      {/* Shown for every Prime user immediately — waiting for the channel
       routing data (Infini lookup / RevenueCat manage url) made the item pop
       in noticeably late. The click handler resolves the destination behind
       a loading dialog instead, and falls back to a refresh + toast when
       neither channel resolves (e.g. sandbox payment succeeded locally but
       the server state lags). */}
      {isPrime ? (
        <ActionList.Item
          label={intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
          icon="CreditCardOutline"
          onClose={handleActionListClose}
          // Declaring the `close` param opts out of ActionList's
          // close-after-onPress behavior: the menu must close before the
          // destination is resolved, otherwise it would stay open underneath
          // the loading dialog until the resolution finishes.
          onPress={async (close) => {
            close();
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
              onPress={async (close) => {
                close();
                await timerUtils.wait(300);
                await purchase({
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
