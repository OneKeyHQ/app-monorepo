/* cspell:ignore Infini */
import { useCallback } from 'react';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { usePrimeSubscriptionManagementTarget } from './usePrimeSubscriptionManagementTarget';

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

  const managementTarget = usePrimeSubscriptionManagementTarget({
    primeSubscription,
    subscriptionManageUrl,
    onekeyUserId: currentOneKeyUserId,
  });

  const handleManageSubscription = useCallback(() => {
    if (managementTarget?.type === 'infini') {
      defaultLogger.prime.subscription.primeManageSubscriptionClick({
        target: 'infiniPage',
      });
      navigation.push(EPrimePages.PrimeInfiniSubscription);
      return;
    }
    if (managementTarget?.type === 'external') {
      defaultLogger.prime.subscription.primeManageSubscriptionClick({
        target: 'externalUrl',
      });
      openUrlUtils.openUrlExternal(managementTarget.url);
      return;
    }
    defaultLogger.prime.subscription.primeManageSubscriptionClick({
      target: 'unresolved',
    });
    Toast.message({
      title: intl.formatMessage({
        id: ETranslations.prime_subscription_management_unsupported__msg,
      }),
    });
  }, [intl, managementTarget, navigation]);

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

      {isPrime && currentOneKeyUserId ? (
        <ActionList.Item
          testID={PrimeTestIDs.manageSubscriptionMenuItem}
          label={intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
          icon="CreditCardOutline"
          onClose={handleActionListClose}
          onPress={(close) => {
            close();
            handleManageSubscription();
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
