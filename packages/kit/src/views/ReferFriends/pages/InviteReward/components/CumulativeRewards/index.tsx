import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Divider,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useNavigateToEditAddress } from '../../../EditAddress/hooks/useNavigateToEditAddress';

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
    <XStack jc="space-between" ai="center">
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
  const navigateToEditAddress = useNavigateToEditAddress();
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const isNewEditWithdrawAddress = withdrawAddresses.length === 0;

  const toEditAddressPage = useCallback(() => {
    navigateToEditAddress({
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
    });
  }, [
    activeAccount.account?.id,
    enabledNetworks,
    fetchSummaryInfo,
    intl,
    isNewEditWithdrawAddress,
    navigateToEditAddress,
    withdrawAddresses,
  ]);

  return (
    <YStack borderRadius="$3">
      <YStack
        position="relative"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        zIndex={1}
        bg="$bgApp"
        p="$4"
        gap="$4"
      >
        <XStack
          jc="space-between"
          ai="center"
          gap="$4"
          $md={{ flexDirection: 'column', jc: 'flex-start', ai: 'flex-start' }}
        >
          <YStack flex={1}>
            <XStack ai="center" jc="space-between">
              <XStack gap="$1" ai="center">
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_cumulative_rewards,
                  })}
                </SizableText>
              </XStack>
            </XStack>
            <Currency size="$heading4xl" color="$text" formatter="value">
              {BigNumber(cumulativeRewards.distributed)
                .plus(cumulativeRewards.undistributed)
                .toFixed(2)}
            </Currency>
          </YStack>
          <YStack flex={1} gap="$3" $md={{ width: '100%' }}>
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
        </XStack>

        <Divider />

        <XStack jc="space-between" ai="center">
          <YStack gap="$1.5">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.referral_reward_received_address,
              })}
            </SizableText>

            {withdrawAddresses.length ? (
              <XStack gap="$1" ai="center">
                <NetworkAvatar
                  networkId={withdrawAddresses[0].networkId}
                  size="$4"
                />
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  flexShrink={1}
                  numberOfLines={10}
                >
                  {accountUtils.shortenAddress({
                    address: withdrawAddresses[0].address,
                  })}
                </SizableText>
              </XStack>
            ) : (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                flexShrink={1}
                numberOfLines={10}
              >
                {intl.formatMessage({
                  id: ETranslations.referral_reward_received_address_notset,
                })}
              </SizableText>
            )}
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
      <YStack
        bg="$bgSubdued"
        borderBottomLeftRadius="$3"
        borderBottomRightRadius="$3"
        pt="$2"
        mt="$-2"
      >
        <XStack px="$4" h={36} ai="center" jc="space-between">
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
  );
}
