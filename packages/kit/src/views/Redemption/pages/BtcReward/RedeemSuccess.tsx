import { useCallback } from 'react';

import { CommonActions, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { DescriptionItem } from '@onekeyhq/kit/src/components/DescriptionItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { formatUsd, getBtcRewardPayoutDate } from '../../utils';

import type { RouteProp } from '@react-navigation/core';

type IRouteParams = RouteProp<
  {
    BtcRewardSuccess: {
      rewardUsd: number;
      walletAddress: string;
      btcAmount: string;
      btcPriceUsd: string;
      payoutEligibleAt: string;
    };
  },
  'BtcRewardSuccess'
>;

function RedeemSuccessPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IRouteParams>();
  const { rewardUsd, walletAddress, btcAmount, btcPriceUsd, payoutEligibleAt } =
    route.params;

  const handleViewHistory = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: EModalReferFriendsRoutes.RedemptionHistory }],
      }),
    );
  }, [navigation]);

  const handleDone = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_success })}
        headerLeft={() => null}
      />
      <Page.Body px="$5" py="$8">
        <YStack alignItems="center" gap="$6" pt="$6">
          <Stack
            bg="$bgSuccessStrong"
            borderRadius="$full"
            p="$5"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name="CheckLargeOutline" size="$12" color="$iconInverse" />
          </Stack>

          <YStack alignItems="center" gap="$2">
            <SizableText size="$headingXl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.redemption_btc_success_title,
              })}
            </SizableText>
            <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.redemption_btc_success_description,
              })}
            </SizableText>
          </YStack>

          <YStack bg="$bgSubdued" borderRadius="$3" p="$4" w="100%" gap="$3">
            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_order_reward,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage(
                  { id: ETranslations.redemption_btc_success_reward_value },
                  {
                    amount: btcAmount,
                    usd: formatUsd(rewardUsd),
                  },
                )}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.redemption_btc_label_btc_price_locked,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {formatUsd(btcPriceUsd)}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.global_network })}
              </SizableText>
              <SizableText size="$bodyMdMedium">Base</SizableText>
            </XStack>

            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.redemption_btc_success_label_to_address,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {accountUtils.shortenAddress({ address: walletAddress })}
              </SizableText>
            </XStack>

            <Divider />

            <DescriptionItem
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_success_eligible_label_title,
              })}
              infoTooltip={intl.formatMessage({
                id: ETranslations.redemption_btc_success_eligible_label_tooltip,
              })}
              value={formatDate(getBtcRewardPayoutDate(payoutEligibleAt), {
                hideTimeForever: true,
              })}
            />
          </YStack>
        </YStack>
      </Page.Body>

      <Page.Footer
        onConfirm={handleDone}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
        onCancel={handleViewHistory}
        onCancelText={intl.formatMessage({
          id: ETranslations.redemption_btc_success_view_history,
        })}
      />
    </Page>
  );
}

export default RedeemSuccessPage;
