import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ReferralCardEmpty } from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralCardEmpty';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  useInviteListCardStyle,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { useNavigateToWalletAddresses } from '../../YourReferredWalletAddresses/hooks/useNavigateToWalletAddresses';

// Each list leads with its total as a quiet caption (label, then the count),
// like the invite home's group captions, then the rows in one card.
function ListCaption({ label, total }: { label: string; total: number }) {
  return (
    <XStack ai="center" gap="$1.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium">{total}</SizableText>
    </XStack>
  );
}

function ListSkeleton() {
  const cardStyle = useInviteListCardStyle();
  return (
    <YStack gap="$2">
      <Skeleton.BodyMd w={120} />
      <YStack gap="$4" p="$4" {...cardStyle}>
        {[0, 1, 2].map((index) => (
          <XStack key={index} jc="space-between">
            <Skeleton.BodyMd w={96} />
            <Skeleton.BodyMd w={72} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function ListEmpty() {
  const intl = useIntl();
  const cardStyle = useInviteListCardStyle();
  return (
    <ReferralCardEmpty
      {...cardStyle}
      title={intl.formatMessage({ id: ETranslations.referral_referred_empty })}
      description={intl.formatMessage({
        id: ETranslations.referral_reward_empty_desc,
      })}
    />
  );
}

function ListSection({
  label,
  total,
  children,
}: {
  label: string;
  total: number;
  children: ReactNode;
}) {
  const cardStyle = useInviteListCardStyle();
  return (
    <YStack gap="$2">
      <ListCaption label={label} total={total} />
      {total === 0 ? (
        <ListEmpty />
      ) : (
        <YStack px="$4" py="$1" {...cardStyle}>
          {children}
        </YStack>
      )}
    </YStack>
  );
}

// Wallets created through the user's codes; each opens its addresses.
export function ReferredWalletList() {
  const intl = useIntl();
  const navigateToWalletAddresses = useNavigateToWalletAddresses();
  const { result, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getEarnWalletHistory(),
    [],
    {
      watchLoading: true,
      initResult: {
        total: 0,
        items: [],
        networks: [],
      },
    },
  );

  if (isLoading) {
    return <ListSkeleton />;
  }

  const { total = 0, items, networks } = result;

  return (
    <ListSection
      label={intl.formatMessage({
        id: ETranslations.referral_referred_total_wallets,
      })}
      total={total}
    >
      {items.map((item, index) => (
        <ListItem
          key={index}
          {...COMPACT_ROW_BLEED_PROPS}
          titleProps={COMPACT_ENTRY_TITLE_PROPS}
          title={`Wallet ${index + 1}`}
          drillIn
          onPress={() => {
            navigateToWalletAddresses({
              items: item.items,
              networks,
            });
          }}
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              {
                id: ETranslations.referral_your_referred_wallets_more_address,
              },
              {
                amount: item.total > 999 ? '999+' : item.total,
              },
            )}
          </SizableText>
        </ListItem>
      ))}
    </ListSection>
  );
}

// Hardware orders placed through the user's codes.
export function ReferredHardwareOrders() {
  const intl = useIntl();
  const { result, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceReferralCode.getHardwareSalesRewardHistory(),
    [],
    {
      watchLoading: true,
      initResult: {
        total: 0,
        items: [],
      },
    },
  );

  if (isLoading) {
    return <ListSkeleton />;
  }

  const { total = 0, items } = result;

  return (
    <ListSection
      label={intl.formatMessage({
        id: ETranslations.referral_referred_total_orders,
      })}
      total={total}
    >
      {items.map((item, key) => (
        <XStack key={key} minHeight={44} py="$2" ai="center" gap="$3">
          <YStack flex={1} minWidth={0}>
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {item.orderName}
            </SizableText>
            {item.source ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {item.source}
              </SizableText>
            ) : null}
          </YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {item.createdAt
              ? formatDate(item.createdAt, {
                  formatTemplate: 'yyyy-LL-dd HH:mm',
                })
              : ''}
          </SizableText>
        </XStack>
      ))}
    </ListSection>
  );
}
