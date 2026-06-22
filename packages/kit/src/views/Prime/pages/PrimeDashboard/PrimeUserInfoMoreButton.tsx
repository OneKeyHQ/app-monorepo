import { useCallback, useEffect } from 'react';

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
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePrimePurchaseCallback } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { PrimeTestIDs } from '../../testIDs';

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
            {user?.email}
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
      {isPrime && subscriptionManageUrl ? (
        <ActionList.Item
          label={intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
          icon="CreditCardOutline"
          onClose={handleActionListClose}
          onPress={() => {
            openUrlUtils.openUrlExternal(subscriptionManageUrl);
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
