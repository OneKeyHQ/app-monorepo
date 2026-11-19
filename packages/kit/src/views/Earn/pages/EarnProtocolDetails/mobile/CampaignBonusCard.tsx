import { useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { formatLocalizedNumberString } from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IEarnBonusProgress } from '@onekeyhq/shared/types/staking';

import { EarnTestIDs } from '../../../testIDs';

import { TransactionLink } from './TransactionLink';

const DEPOSITS_PER_PAGE = 3;
const ONE_DAY_MS = timerUtils.getTimeDurationMs({ day: 1 });

function BonusDeposits({
  deposits,
  hideValue,
}: {
  deposits: IEarnBonusProgress['deposits'];
  hideValue: boolean;
}) {
  const intl = useIntl();
  const [selectedPage, setSelectedPage] = useState(1);
  const pageCount = Math.ceil(deposits.length / DEPOSITS_PER_PAGE);
  const page = Math.min(selectedPage, pageCount);
  if (page !== selectedPage) {
    setSelectedPage(page);
  }
  const start = (page - 1) * DEPOSITS_PER_PAGE;
  const now = Date.now();

  return (
    <>
      <YStack gap="$2">
        {deposits
          .slice(start, start + DEPOSITS_PER_PAGE)
          .map((deposit, idx) => {
            const remainingDays = Math.ceil(
              (deposit.maturesAt - now) / ONE_DAY_MS,
            );
            const isMatured = remainingDays <= 0;
            const holdingDays = Math.round(
              (deposit.maturesAt - deposit.depositedAt) / ONE_DAY_MS,
            );
            const amount = hideValue
              ? '****'
              : formatLocalizedNumberString(deposit.amount);

            return (
              <XStack
                key={`${deposit.symbol}-${deposit.depositedAt}-${start + idx}`}
                ai="center"
                jc="space-between"
                gap="$2"
              >
                <SizableText size="$bodyMdMedium" flexShrink={1}>
                  {`${amount} ${deposit.symbol}`}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  flexShrink={1}
                  textAlign="right"
                  color={isMatured ? '$textSuccess' : '$textSubdued'}
                >
                  {intl.formatMessage(
                    {
                      id: isMatured
                        ? ETranslations.earn_bonus_held_days__desc
                        : ETranslations.earn_number_days_left,
                    },
                    { number: isMatured ? holdingDays : remainingDays },
                  )}
                </SizableText>
              </XStack>
            );
          })}
      </YStack>
      {pageCount > 1 ? (
        <XStack ai="center" jc="space-between" gap="$2">
          <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
            {intl.formatMessage(
              { id: ETranslations.earn_bonus_deposit_count__title },
              { count: deposits.length },
            )}
          </SizableText>
          <XStack ai="center" gap="$1">
            <IconButton
              testID={EarnTestIDs.campaignBonusPreviousPage}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.global_back,
              })}
              icon="ChevronLeftOutline"
              size="small"
              variant="tertiary"
              p="$0"
              m="$0"
              disabled={page === 1}
              onPress={() => setSelectedPage(page - 1)}
            />
            <SizableText size="$bodySm" color="$textSubdued">
              {`${intl.formatNumber(page)}/${intl.formatNumber(pageCount)}`}
            </SizableText>
            <IconButton
              testID={EarnTestIDs.campaignBonusNextPage}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.global_next,
              })}
              icon="ChevronRightOutline"
              size="small"
              variant="tertiary"
              p="$0"
              m="$0"
              disabled={page === pageCount}
              onPress={() => setSelectedPage(page + 1)}
            />
          </XStack>
        </XStack>
      ) : null}
    </>
  );
}

export function CampaignBonusCard({
  progress,
  networkId,
}: {
  progress: IEarnBonusProgress;
  networkId: string;
}) {
  const intl = useIntl();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { status, payoutAt, paidAt, txHash, bonus, deposits } = progress;
  const showsDepositProgress = status === 'earning' || status === 'waiting';
  const confirmedTxHash =
    status === 'paid' &&
    paidAt !== undefined &&
    typeof txHash === 'string' &&
    hexUtils.isHexString(txHash, 32)
      ? txHash
      : undefined;
  const dateFormat = { month: 'short', day: 'numeric' } as const;
  const amount = hideValue
    ? '****'
    : `${progress.isEstimated ? '≈' : ''}+${formatLocalizedNumberString(bonus.amount)}`;

  let payoutLabel: string;
  if (showsDepositProgress) {
    payoutLabel = intl.formatMessage(
      { id: ETranslations.earn_bonus_payout_on__desc },
      { date: intl.formatDate(payoutAt, dateFormat) },
    );
  } else if (status === 'paying') {
    payoutLabel = intl.formatMessage({
      id: ETranslations.earn_bonus_paying_out__title,
    });
  } else if (paidAt !== undefined) {
    payoutLabel = intl.formatMessage(
      { id: ETranslations.earn_bonus_paid_on__desc },
      { date: intl.formatDate(paidAt, dateFormat) },
    );
  } else {
    payoutLabel = intl.formatMessage({ id: ETranslations.earn_claimed });
  }

  return (
    <YStack
      testID={EarnTestIDs.campaignBonusCard}
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      gap="$3"
    >
      <YStack gap="$0.5">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {progress.title}
        </SizableText>
        <XStack ai="center" jc="space-between" gap="$2">
          <SizableText size="$bodyLgMedium" color="$textSuccess" flexShrink={1}>
            {`${amount} ${bonus.symbol}`}
          </SizableText>
          {confirmedTxHash ? (
            <TransactionLink
              networkId={networkId}
              txHash={confirmedTxHash}
              label={payoutLabel}
              accessibilityLabel={`${payoutLabel}. ${intl.formatMessage({
                id: ETranslations.settings_view_transaction_in_explorer,
              })}`}
            />
          ) : (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexShrink={1}
              textAlign="right"
            >
              {payoutLabel}
            </SizableText>
          )}
        </XStack>
      </YStack>
      {showsDepositProgress && deposits.length ? (
        <BonusDeposits deposits={deposits} hideValue={hideValue} />
      ) : null}
    </YStack>
  );
}
