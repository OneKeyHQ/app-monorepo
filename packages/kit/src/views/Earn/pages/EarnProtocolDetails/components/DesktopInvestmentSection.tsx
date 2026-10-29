import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PortfolioPendingTxsProvider } from '../../../components/PortfolioTabContent';
import { HoldingSectionsTable } from '../../EarnPositions/desktop/EarnPositionDesktopBlock';
import { EarnPositionHealthFactorRow } from '../../EarnPositions/EarnPositionHealthFactorRow';
import { useHoldingRedeem } from '../../EarnPositions/mobile/EarnPositionCard';
import { HoldingInvestmentGrid } from '../mobile/PortfolioTab';

import type { IEarnHoldingRedeem } from '../../EarnPositions/mobile/EarnHoldingSections';
import type { IEarnPositionCardHandlers } from '../../EarnPositions/mobile/EarnPositionCard';
import type { IEarnPositionView } from '../../EarnPositions/mobile/earnPositionModel';

/**
 * The wide page's own holding, where the phone has its Portfolio tab: the
 * figures, then the holding's rows as My portfolio's wide layout draws them,
 * the same card on both pages (demo 10-29). Redeem shows, reads and greys
 * as there; the page decides where it goes. Claim works as it does there.
 * A page whose holding My portfolio has no Redeem for (a lending supply)
 * hands its own way out instead
 */
export function DesktopInvestmentSection({
  holding,
  onRedeem,
  redeem: ownRedeem,
  onActionSuccess,
}: {
  holding: IEarnPositionView;
  onRedeem?: IEarnPositionCardHandlers['onRedeem'];
  redeem?: IEarnHoldingRedeem;
  // A claim broadcast from the rows: the page reads its numbers again
  onActionSuccess?: () => void;
}) {
  const intl = useIntl();
  const cardRedeem = useHoldingRedeem(holding, onRedeem);
  const redeem = ownRedeem ?? cardRedeem;
  const pendingTxsValue = useMemo(
    () => ({
      onRefresh: async () => {
        onActionSuccess?.();
      },
    }),
    [onActionSuccess],
  );
  return (
    <YStack gap="$6" testID="earn-detail-investment">
      <SizableText size="$headingLg">
        {intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_investment,
        })}
      </SizableText>
      {/* The Intro grid's spacing, so the two sections' columns line up */}
      <HoldingInvestmentGrid holding={holding} m="$-5" p="$2" />
      {holding.meta?.kind === 'healthFactor' ? (
        <EarnPositionHealthFactorRow meta={holding.meta} />
      ) : null}
      <PortfolioPendingTxsProvider value={pendingTxsValue}>
        <HoldingSectionsTable position={holding} redeem={redeem} />
      </PortfolioPendingTxsProvider>
    </YStack>
  );
}
