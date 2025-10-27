import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Divider,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePrimePurchaseCallback } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

function PrimeUserInfoMoreButtonDropDownMenu({
  handleActionListClose,
  onLogoutSuccess,
}: {
  handleActionListClose: () => void;
  onLogoutSuccess?: () => Promise<void>;
}) {
  const { logout, user } = usePrimeAuthV2();
  const isPrime = user?.primeSubscription?.isActive;
  const primeExpiredAt = user?.primeSubscription?.expiresAt;
  const { getCustomerInfo } = usePrimePayment();
  const [devSettings] = useDevSettingsPersistAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { purchase } = usePrimePurchaseCallback();

  const refreshUserInfo = useCallback(async () => {
    void getCustomerInfo();
    void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
  }, [getCustomerInfo]);

  useEffect(() => {
    void refreshUserInfo();
  }, [refreshUserInfo]);

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

        {/* {isPrime ? (
          <Badge bg="$brand3" badgeSize="sm">
            <Badge.Text color="$brand11">Prime</Badge.Text>
          </Badge>
        ) : (
          <Badge badgeType="default" badgeSize="sm">
            {intl.formatMessage({
              id: ETranslations.prime_status_free,
            })}
          </Badge>
        )} */}
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
      {isPrime && user.subscriptionManageUrl ? (
        <ActionList.Item
          label={intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
          icon="CreditCardOutline"
          onClose={handleActionListClose}
          onPress={async () => {
            if (user.subscriptionManageUrl) {
              openUrlUtils.openUrlExternal(user.subscriptionManageUrl);
            } else {
              Toast.message({
                title: 'Please try again later',
              });
              await refreshUserInfo();
            }
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
          id: ETranslations.prime_device_management,
        })}
        icon="MultipleDevicesOutline"
        onClose={handleActionListClose}
        onPress={() => {
          navigation.pushModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeDeviceLimit,
          });
        }}
      />
      <ActionList.Item
        label={intl.formatMessage({
          id: ETranslations.prime_log_out,
        })}
        icon="LogoutOutline"
        onClose={handleActionListClose}
        onPress={() => {
          Dialog.show({
            icon: 'InfoCircleOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_onekeyid_log_out,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_onekeyid_log_out_description,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.prime_log_out,
            }),
            onConfirm: async () => {
              await logout();
              await onLogoutSuccess?.();
            },
          });
        }}
      />
    </>
  );
}

export function PrimeUserInfoMoreButton({
  onLogoutSuccess,
}: {
  onLogoutSuccess?: () => Promise<void>;
}) {
  const intl = useIntl();
  const renderItems = useCallback(
    ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
      handleActionListOpen: () => void;
    }) => (
      <PrimeUserInfoMoreButtonDropDownMenu
        handleActionListClose={handleActionListClose}
        onLogoutSuccess={onLogoutSuccess}
      />
    ),
    [onLogoutSuccess],
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
          icon="DotHorOutline"
          variant="tertiary"
          size="small"
          onPress={() => {
            console.log('1');
          }}
        />
      }
    />
  );
}
