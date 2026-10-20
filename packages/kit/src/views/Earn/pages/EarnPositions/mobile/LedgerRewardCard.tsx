import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import { TransactionLink } from '../../EarnProtocolDetails/mobile/TransactionLink';

/** What a server-formatted amount reads as under the hide-balances switch. */
const HIDDEN_AMOUNT = { text: '****' };

function FactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight={28}>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

/**
 * One Pending / Distributed ledger reward as its own card (figma
 * 29180-109399 / 29180-109764): the token on top, then the reward as fiat
 * with the token amount under it (the figure style of every other card),
 * the payout date the stage is about, and for distributed rows the
 * transaction.
 */
export function LedgerRewardCard({
  item,
  group,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const isDistributed = item.stage === 'distributed';
  const time = isDistributed ? item.distributedAt : item.availableAt;
  const timeLabel = intl.formatMessage({
    id: isDistributed
      ? ETranslations.earn_distributed_time__title
      : ETranslations.earn_est_distribute_time__title,
  });

  return (
    <YStack
      gap="$1"
      p="$3"
      borderRadius="$3"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bg"
    >
      <XStack ai="center" gap="$2" pb="$1">
        <Token
          size="sm"
          tokenImageUri={item.token.info.logoURI}
          showNetworkIcon
          networkId={group.networkId}
        />
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {item.token.info.symbol}
        </SizableText>
      </XStack>
      <FactRow label={intl.formatMessage({ id: ETranslations.earn_rewards })}>
        <YStack ai="flex-end" flexShrink={1}>
          {item.fiatValue ? (
            <NumberSizeableTextWrapper
              hideValue
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: currencyInfo.symbol }}
              numberOfLines={1}
            >
              {item.fiatValue}
            </NumberSizeableTextWrapper>
          ) : null}
          {/* the amount comes formatted from the server: hidden as a whole */}
          <EarnText
            text={hideValue ? HIDDEN_AMOUNT : item.title}
            size={item.fiatValue ? '$bodySm' : '$bodySmMedium'}
            color={item.fiatValue ? '$textSubdued' : '$textSuccess'}
            numberOfLines={1}
          />
        </YStack>
      </FactRow>
      {time ? (
        <FactRow label={timeLabel}>
          <SizableText size="$bodySmMedium" numberOfLines={1}>
            {formatDate(new Date(time), { hideTimeForever: true })}
          </SizableText>
        </FactRow>
      ) : null}
      {isDistributed && item.txHash ? (
        <FactRow
          label={intl.formatMessage({
            id: ETranslations.global_transaction_id,
          })}
        >
          <TransactionLink networkId={group.networkId} txHash={item.txHash} />
        </FactRow>
      ) : null}
    </YStack>
  );
}
