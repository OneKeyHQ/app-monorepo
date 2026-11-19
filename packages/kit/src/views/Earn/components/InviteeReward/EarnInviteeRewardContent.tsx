import { useCallback } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Empty,
  Icon,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { InviteeRewardNoWallet } from '@onekeyhq/kit/src/views/ReferFriends/components/InviteeRewardNoWallet';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import type {
  IEarnAlert,
  IEarnSummaryV2,
} from '@onekeyhq/shared/types/staking';

import { loadEarnInviteeReward } from './utils';

function RebateHistoryAction({
  actionIcon,
  onPress,
}: {
  actionIcon: IEarnSummaryV2['distributed'][number]['button'];
  onPress: () => void;
}) {
  return (
    <XStack
      role="button"
      gap="$1.5"
      cursor="pointer"
      ai="center"
      hitSlop={12}
      onPress={onPress}
    >
      <Icon name="ClockTimeHistoryOutline" size="$5" color="$iconSubdued" />
      <EarnText
        text={{
          ...actionIcon.text,
          size: '$bodyLg',
          color: '$textSubdued',
        }}
      />
    </XStack>
  );
}

function RebateList({
  rebateData,
  onHistory,
}: {
  rebateData: IEarnSummaryV2;
  onHistory: () => void;
}) {
  const intl = useIntl();

  return (
    <YStack overflow="hidden" borderRadius="$3">
      {isEmpty(rebateData.distributed) ? null : (
        <SizableText mx="$5" size="$bodyMdMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_distributed })}
        </SizableText>
      )}
      {rebateData.distributed.map((item, index) => {
        const needDivider =
          index === rebateData.distributed.length - 1 &&
          !isEmpty(rebateData.undistributed);

        return (
          <Stack key={`distributed-${index}`}>
            <ListItem ai="center" jc="space-between" borderWidth="$0">
              <XStack ai="center" gap="$2.5">
                <Token size="md" tokenImageUri={item.token.logoURI} />
                <EarnText
                  text={{
                    ...item.title,
                    size: '$bodyLgMedium',
                    color: '$text',
                  }}
                />
              </XStack>
              <RebateHistoryAction
                actionIcon={item.button}
                onPress={onHistory}
              />
            </ListItem>
            {needDivider ? <Divider mx="$5" my="$2.5" /> : null}
          </Stack>
        );
      })}
      {isEmpty(rebateData.undistributed) ? null : (
        <SizableText mx="$5" size="$bodyMdMedium" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
        </SizableText>
      )}
      {rebateData.undistributed.map((item, index) => (
        <ListItem
          key={`undistributed-${index}`}
          ai="center"
          jc="space-between"
          borderWidth="$0"
        >
          <XStack ai="center" jc="space-between" w="100%">
            <XStack gap="$2.5" ai="center">
              <Token size="md" tokenImageUri={item.token.logoURI} />
              <EarnText
                text={{
                  ...item.title,
                  size: '$bodyLgMedium',
                  color: '$text',
                }}
              />
            </XStack>
            <EarnText
              text={{
                ...item.description,
                size: '$bodyLg',
                color: '$textSubdued',
              }}
            />
          </XStack>
        </ListItem>
      ))}
      <Stack
        mt="$2.5"
        px="$pagePadding"
        py="$3.5"
        borderTopWidth={1}
        borderTopColor="$borderSubdued"
      >
        <EarnText
          text={{
            ...rebateData.description,
            size: '$bodyMd',
            color: '$textSubdued',
          }}
        />
      </Stack>
    </YStack>
  );
}

export function EarnInviteeRewardContent({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const dialog = useDialogInstance();
  const { gtMd } = useMedia();
  const evmNetworkId = getNetworkIdsMap().eth;

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      return loadEarnInviteeReward({
        accountId,
        indexedAccountId,
        dependencies: {
          ethNetworkId: evmNetworkId,
          getEarnAccount: (params) =>
            backgroundApiProxy.serviceStaking.getEarnAccount(params),
          getEarnSummaryV2: (params) =>
            backgroundApiProxy.serviceStaking.getEarnSummaryV2(params),
        },
      });
    },
    [accountId, evmNetworkId, indexedAccountId],
    { watchLoading: true },
  );

  const handleHistoryPress = useCallback(async () => {
    if (result?.status !== 'success') {
      return;
    }

    // Dismiss this dialog/sheet first, otherwise the pushed history screen ends
    // up behind the still-open overlay on native.
    await dialog.close();

    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.HistoryList,
      params: {
        title: intl.formatMessage({
          id: ETranslations.referral_reward_history,
        }),
        alerts: [
          {
            key: ESpotlightTour.earnRewardHistory,
            badge: 'info',
            alert: intl.formatMessage({
              id: ETranslations.earn_reward_distribution_schedule,
            }),
          } as IEarnAlert,
        ],
        accountId: result.earnAccount.accountId || '',
        networkId: evmNetworkId,
        filterType: 'rebate',
      },
    });
  }, [dialog, evmNetworkId, intl, navigation, result]);

  const handleBeforeNavigate = useCallback(() => dialog.close(), [dialog]);

  if (!accountId && !indexedAccountId) {
    return (
      <InviteeRewardNoWallet
        testID="earn-invitee-reward-onboarding"
        onBeforeNavigate={handleBeforeNavigate}
      />
    );
  }

  if (!result || (isLoading && result.status !== 'success')) {
    return (
      <YStack minHeight={220} ai="center" jc="center">
        <Spinner />
      </YStack>
    );
  }

  if (result.status === 'no-wallet') {
    return (
      <InviteeRewardNoWallet
        testID="earn-invitee-reward-onboarding"
        onBeforeNavigate={handleBeforeNavigate}
      />
    );
  }

  if (result.status === 'unsupported') {
    return (
      <YStack minHeight={220} jc="center" ai="center" py="$10">
        <Empty
          icon="WalletOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_data })}
        />
      </YStack>
    );
  }

  if (result.status === 'error') {
    return (
      <YStack minHeight={220} jc="center" ai="center" gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
        <Button
          testID="earn-invitee-reward-retry"
          size="small"
          variant="secondary"
          onPress={() => {
            void run();
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  if (isEmpty(result.data.distributed) && isEmpty(result.data.undistributed)) {
    return (
      <YStack minHeight={220} jc="center" ai="center" py="$10">
        <Empty
          icon="GiftOutline"
          title={intl.formatMessage({
            id: ETranslations.earn_referral_bonus,
          })}
          description={intl.formatMessage({
            id: ETranslations.global_no_data,
          })}
        />
      </YStack>
    );
  }

  return (
    <ScrollView maxHeight={gtMd ? 520 : 360} mx="$-5">
      <RebateList rebateData={result.data} onHistory={handleHistoryPress} />
    </ScrollView>
  );
}
