import { useCallback } from 'react';

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
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

function PrimeUserInfoMoreButtonDropDownMenu({
  handleActionListClose,
  doPurchase,
  onLogoutSuccess,
}: {
  handleActionListClose: () => void;
  doPurchase?: () => Promise<void>;
  onLogoutSuccess?: () => Promise<void>;
}) {
  const { logout, user } = usePrimeAuthV2();
  const isPrime = user?.primeSubscription?.isActive;
  const primeExpiredAt = user?.primeSubscription?.expiresAt;
  const { getCustomerInfo } = usePrimePayment();
  const [devSettings] = useDevSettingsPersistAtom();
  const intl = useIntl();

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
      {isPrime || user.subscriptionManageUrl ? (
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
              await Promise.all([
                backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo(),
                getCustomerInfo(),
              ]);
            }
          }}
        />
      ) : null}

      {isPrime ? (
        <>
          {devSettings?.enabled ? (
            <ActionList.Item
              label="Change Subscription"
              icon="CreditCardOutline"
              onClose={handleActionListClose}
              onPress={async () => {
                void doPurchase?.();
              }}
            />
          ) : null}
        </>
      ) : null}

      <Divider mx="$2" my="$1" />
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
  doPurchase,
  onLogoutSuccess,
}: {
  doPurchase?: () => Promise<void>;
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
        doPurchase={doPurchase}
        onLogoutSuccess={onLogoutSuccess}
      />
    ),
    [doPurchase, onLogoutSuccess],
  );
  return (
    <ActionList
      title={intl.formatMessage({
        id: ETranslations.global_account,
      })}
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
