import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IColorTokens } from '@onekeyhq/components';
import {
  Badge,
  Divider,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import { HardwareRecordStatusBadge } from './components/HardwareRecordStatusBadge';
import {
  HardwareRecordTimeline,
  formatTimestamp,
} from './components/HardwareRecordTimeline';

import type { RouteProp } from '@react-navigation/core';

type IRouteProps = RouteProp<
  IModalReferFriendsParamList,
  EModalReferFriendsRoutes.HardwareSalesOrderDetail
>;

type IHardwareRecordStatus =
  | 'Completed'
  | 'Pending'
  | 'Undistributed'
  | 'Refunded';

const statusToRewardColor: Record<IHardwareRecordStatus, IColorTokens> = {
  Completed: '$textSuccess',
  Undistributed: '$textInfo',
  Refunded: '$textSubdued',
  Pending: '$textCaution',
};

function HardwareSalesOrderDetailPageWrapper() {
  const intl = useIntl();
  const route = useRoute<IRouteProps>();
  const { data } = route.params;

  const rewardColor =
    statusToRewardColor[(data.status as IHardwareRecordStatus) ?? ''] ||
    '$textSuccess';

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_details,
        })}
      />
      <Page.Body>
        <ReferFriendsPageContainer flex={1}>
          <ScrollView flex={1}>
            {/* Order Details - Two column grid layout */}
            <XStack flexWrap="wrap" pt="$3" px="$5" pb="$5">
              {/* Row 1: Time | Order ID */}
              <YStack width="50%" gap="$1.5" pr="$2" pb="$6">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_time })}
                </SizableText>
                <SizableText size="$bodyMdMedium">
                  {formatTimestamp(data.orderPlacedAt)}
                </SizableText>
              </YStack>
              <YStack width="50%" gap="$1.5" pr="$2" pb="$6">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_order_id,
                  })}
                </SizableText>
                <SizableText size="$bodyMdMedium">
                  {data.itemUniqueId}
                </SizableText>
              </YStack>

              {/* Row 2: Status | Rewards */}
              <YStack width="50%" gap="$1.5" pr="$2" pb="$6" ai="flex-start">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_status })}
                </SizableText>
                <YStack>
                  <HardwareRecordStatusBadge
                    status={data.status}
                    statusLabel={data.statusLabel}
                  />
                </YStack>
              </YStack>
              <YStack width="50%" gap="$1.5" pr="$2" pb="$6">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.referral_rewards })}
                </SizableText>
                <Currency
                  color={rewardColor}
                  formatter="value"
                  size="$bodyMdMedium"
                  formatterOptions={{
                    showPlusMinusSigns: true,
                  }}
                >
                  {data.rebateAmountFiatValue}
                </Currency>
              </YStack>

              {/* Row 3: Referral code */}
              <YStack width="50%" gap="$1.5" pr="$2">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_referral_code,
                  })}
                </SizableText>
                <XStack ai="center" gap="$2">
                  <Badge badgeType="default" badgeSize="sm">
                    {data.inviteCode}
                  </Badge>
                  {data.inviteCodeRemark ? (
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {data.inviteCodeRemark}
                    </SizableText>
                  ) : null}
                </XStack>
              </YStack>
            </XStack>

            {/* History Timeline */}
            {data.history && data.history.length > 0 ? (
              <>
                <Divider />
                <HardwareRecordTimeline history={data.history} />
              </>
            ) : null}
          </ScrollView>
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function HardwareSalesOrderDetail() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HardwareSalesOrderDetailPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
