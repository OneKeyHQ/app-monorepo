import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  IconButton,
  PROPORTIONAL_NUMS,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { HERO_BALANCE_FIT_PROPS } from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper/heroBalanceFit';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

type IProps = {
  isLoading: boolean;
  currency?: string;
  fiatValue?: string;
  balanceParsed?: string;
  sync?: {
    isRefreshing?: boolean;
    lastSyncedAt?: number;
    onRefresh?: () => void;
  };
};

// The large fiat-value + balance block shared by the per-network header and
// the aggregate Overview tab.
function TokenDetailsBalanceHero({
  isLoading,
  currency,
  fiatValue,
  balanceParsed,
  sync,
}: IProps) {
  const intl = useIntl();
  const { format, formatDate } = useFormatDate();
  const lastSyncedAt = sync?.lastSyncedAt;
  const lastSyncedDate =
    typeof lastSyncedAt === 'number' &&
    lastSyncedAt > 0 &&
    Number.isFinite(new Date(lastSyncedAt).getTime())
      ? new Date(lastSyncedAt)
      : undefined;
  const lastSyncedLabel = lastSyncedDate
    ? intl.formatMessage(
        { id: ETranslations.backup_updated_time },
        { time: formatDate(lastSyncedDate, { hideTheYear: true }) },
      )
    : undefined;
  const lastSyncedFullLabel = lastSyncedDate
    ? intl.formatMessage(
        { id: ETranslations.backup_updated_time },
        { time: format(lastSyncedDate, 'yyyy/LL/dd HH:mm:ss OOOO') },
      )
    : undefined;

  return (
    <YStack gap="$2" mb="$5">
      {isLoading ? (
        <Skeleton.Group show>
          <Skeleton.Heading5Xl />
          <Skeleton.BodyLg />
        </Skeleton.Group>
      ) : (
        <>
          <XStack alignItems="center" gap="$3" flexWrap="wrap">
            <Currency
              hideValue
              splitDecimal
              formatter="value"
              sourceCurrency={currency}
              fontSize={48}
              lineHeight={48}
              fontWeight={500}
              flexShrink={1}
              minWidth={0}
              // Keep the same natural figures as the home balance hero.
              fontVariant={PROPORTIONAL_NUMS}
              {...HERO_BALANCE_FIT_PROPS}
            >
              {displayFiatValueOrUnavailable(fiatValue, balanceParsed)}
            </Currency>
            {sync ? (
              <IconButton
                testID="token-privacy-balance-refresh"
                icon="RefreshCcwOutline"
                variant="tertiary"
                loading={sync.isRefreshing}
                disabled={!sync.onRefresh}
                onPress={sync.onRefresh}
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.global_refresh,
                })}
                aria-label={intl.formatMessage({
                  id: ETranslations.global_refresh,
                })}
                title={intl.formatMessage({
                  id: ETranslations.global_refresh,
                })}
                hotKey
              />
            ) : null}
          </XStack>
          <XStack
            alignItems="center"
            columnGap="$3"
            rowGap="$1"
            flexWrap="wrap"
          >
            <NumberSizeableTextWrapper
              hideValue
              formatter="balance"
              color="$textSubdued"
              size="$bodyLg"
            >
              {displayOrUnavailable(balanceParsed)}
            </NumberSizeableTextWrapper>
            {lastSyncedLabel && lastSyncedFullLabel ? (
              <Tooltip
                renderContent={lastSyncedFullLabel}
                onPress={
                  platformEnv.isNative
                    ? () => {
                        Dialog.show({
                          title: intl.formatMessage({
                            id: ETranslations.global_synced,
                          }),
                          description: lastSyncedFullLabel,
                          showCancelButton: false,
                        });
                      }
                    : undefined
                }
                renderTrigger={
                  <SizableText
                    testID="token-privacy-last-synced"
                    size="$bodySm"
                    color="$textSubdued"
                    tabIndex={0}
                    accessibilityLabel={lastSyncedFullLabel}
                    aria-label={lastSyncedFullLabel}
                  >
                    {`· ${lastSyncedLabel}`}
                  </SizableText>
                }
              />
            ) : null}
          </XStack>
        </>
      )}
    </YStack>
  );
}

export default memo(TokenDetailsBalanceHero);
