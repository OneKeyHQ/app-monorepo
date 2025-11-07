import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function CumulativeRewardsLineItem({
  bg,
  amount,
  title,
}: {
  bg: IStackStyle['bg'];
  title: string;
  amount: string;
}) {
  return (
    <XStack jc="space-between" h={36} ai="center">
      <XStack gap="$2" ai="center" jc="center">
        <Stack w="$2" h="$2" borderRadius="$full" bg={bg} />
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
      </XStack>
      <Currency size="$bodyMdMedium">{BigNumber(amount).toFixed(2)}</Currency>
    </XStack>
  );
}

export function CumulativeRewards({
  cumulativeRewards,
  withdrawAddresses,
  enabledNetworks,
  fetchSummaryInfo,
}: {
  cumulativeRewards: IInviteSummary['cumulativeRewards'];
  withdrawAddresses: IInviteSummary['withdrawAddresses'];
  enabledNetworks: IInviteSummary['enabledNetworks'];
  fetchSummaryInfo: () => void;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const isNewEditWithdrawAddress = withdrawAddresses.length === 0;

  const toEditAddressPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.EditAddress,
      params: {
        enabledNetworks,
        accountId: activeAccount.account?.id ?? '',
        address: withdrawAddresses[0]?.address,
        onAddressAdded: async ({ networkId }: { networkId: string }) => {
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.referral_address_updated,
            }),
          });
          setTimeout(() => {
            fetchSummaryInfo();
          }, 50);
          defaultLogger.referral.page.editReceivingAddress({
            networkId,
            editMethod: isNewEditWithdrawAddress ? 'new' : 'edit',
          });
        },
      },
    });
  }, [
    activeAccount.account?.id,
    enabledNetworks,
    fetchSummaryInfo,
    intl,
    isNewEditWithdrawAddress,
    navigation,
    withdrawAddresses,
  ]);

  const toRewardDistributionHistoryPage = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabRewardDistributionHistory);
  }, [navigation]);

  return (
    <YStack borderRadius="$3">
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        overflow="hidden"
      >
        <YStack>
          <YStack pt="$4" px="$5">
            <XStack ai="center" jc="space-between">
              <XStack gap="$1" ai="center">
                <Icon name="CoinsAddSolid" size="$5" color="$iconSuccess" />
                <SizableText size="$headingMd">
                  {intl.formatMessage({
                    id: ETranslations.referral_cumulative_rewards,
                  })}
                </SizableText>
              </XStack>
              <IconButton
                variant="tertiary"
                iconColor="$iconSubdued"
                icon="ClockTimeHistoryOutline"
                size="small"
                iconSize="$5"
                px="$1.5"
                mr="$-2"
                onPress={toRewardDistributionHistoryPage}
              />
            </XStack>
            <Currency
              textAlign="center"
              size="$heading5xl"
              color="$textSuccessStrong"
              formatter="value"
              my="$6"
            >
              {BigNumber(cumulativeRewards.distributed)
                .plus(cumulativeRewards.undistributed)
                .toFixed(2)}
            </Currency>
          </YStack>
          <YStack px="$5">
            <CumulativeRewardsLineItem
              bg="$iconSuccess"
              title={intl.formatMessage({
                id: ETranslations.referral_distributed,
              })}
              amount={cumulativeRewards.distributed}
            />
            <CumulativeRewardsLineItem
              bg="$iconCaution"
              title={intl.formatMessage({
                id: ETranslations.referral_undistributed,
              })}
              amount={cumulativeRewards.undistributed}
            />
          </YStack>
          <Divider my="$2" mx="$5" />
          <XStack py="$1" px="$5" jc="space-between" ai="center">
            <YStack>
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.referral_reward_received_address,
                })}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                flexShrink={1}
                numberOfLines={10}
              >
                {withdrawAddresses.length
                  ? accountUtils.shortenAddress({
                      address: withdrawAddresses[0].address,
                    })
                  : intl.formatMessage({
                      id: ETranslations.referral_reward_received_address_notset,
                    })}
              </SizableText>
            </YStack>
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_edit })}
              variant="tertiary"
              icon="EditOutline"
              size="small"
              onPress={toEditAddressPage}
              iconColor="$iconSubdued"
            />
          </XStack>
        </YStack>
        <YStack bg="$bgSubdued">
          <XStack
            h="$4"
            bg="$bgApp"
            mx={-1}
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$3"
            shadowColor="rgba(0,0,0,0.04)"
            shadowOffset={{
              width: 0,
              height: 1,
            }}
          />
          <XStack px="$5" h={36} ai="center" jc="space-between">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_next_distribution,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {cumulativeRewards.nextDistribution}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
