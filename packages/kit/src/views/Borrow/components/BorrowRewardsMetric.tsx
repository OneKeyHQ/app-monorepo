import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { buildBorrowMarketKey } from '../borrowMarketKey';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowPlaceholderAmountText } from '../hooks/useBorrowPlaceholderAmountText';
import { useBorrowRewardsClaimDialog } from '../hooks/useBorrowRewardsClaimDialog';
import { useLoadedOnce } from '../hooks/useLoadedOnce';
import { BorrowTestIDs } from '../testIDs';

import { OverviewMetric } from './OverviewMetric';

import type { IOverviewMetricProps } from './OverviewMetric';

/**
 * Claimable rewards as one cell of the overview strip, with the claim dialog
 * behind the value. Lives in its own component because the cell sits at the top
 * of the page on desktop and in the summary below the positions on phones.
 */
export function BorrowRewardsMetric({
  borrowRewards,
  isError = false,
  isLoading,
  onClaimed,
  widthMode,
}: {
  borrowRewards?: IBorrowRewards | null;
  isError?: boolean;
  isLoading?: boolean;
  onClaimed: () => void | Promise<void>;
  widthMode?: IOverviewMetricProps['widthMode'];
}) {
  const intl = useIntl();
  const placeholderAmountText = useBorrowPlaceholderAmountText();
  const { market, earnAccount, pendingTxs } = useBorrowContext();

  const earnAccountId = getBorrowEarnAccountId(earnAccount.data);
  const metricScopeKey = JSON.stringify([
    buildBorrowMarketKey(market ?? undefined),
    earnAccountId,
  ]);
  const hasLoadedRewardsOnce = useLoadedOnce(
    Boolean(borrowRewards && !isError),
    metricScopeKey,
  );

  const { openRewardsDialog: handleShowRewardsDialog } =
    useBorrowRewardsClaimDialog({
      market,
      accountId: earnAccountId,
      borrowRewards,
      pendingTxs,
      isError,
      onClaimed,
    });

  return (
    <OverviewMetric
      title={
        (!isError && borrowRewards?.title) || {
          text: intl.formatMessage({
            id: ETranslations.defi_claimable_rewards,
          }),
        }
      }
      text={
        isError
          ? { text: '-' }
          : (borrowRewards?.description ?? placeholderAmountText)
      }
      isLoading={Boolean(!isError && isLoading && !hasLoadedRewardsOnce)}
      widthMode={widthMode}
      action={
        !isError && borrowRewards && !borrowRewards.button.disabled ? (
          <Button
            testID={BorrowTestIDs.overviewClaimRewardsBtn}
            p="0"
            ai="center"
            size="small"
            variant="link"
            onPress={handleShowRewardsDialog}
          >
            <EarnText
              size="$bodyMdMedium"
              color="$textInfo"
              text={borrowRewards.button.text}
            />
          </Button>
        ) : null
      }
    />
  );
}
