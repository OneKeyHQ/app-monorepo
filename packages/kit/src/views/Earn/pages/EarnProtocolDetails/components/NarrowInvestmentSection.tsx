import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PortfolioPendingTxsProvider } from '../../../components/PortfolioTabContent';
import { EarnPositionHealthFactorRow } from '../../EarnPositions/EarnPositionHealthFactorRow';
import { EarnHoldingSections } from '../../EarnPositions/mobile/EarnHoldingSections';
import { HoldingInvestmentGrid } from '../mobile/PortfolioTab';

import type { IEarnHoldingRedeem } from '../../EarnPositions/mobile/EarnHoldingSections';
import type { IEarnPositionView } from '../../EarnPositions/mobile/earnPositionModel';

/**
 * A narrow page's holding where it has no Portfolio tab (a lending supply's
 * page, demo 10-29): set as the page's other sections are, its heading and
 * figures in the Intro's size and spacing, then the phone tab's panels
 */
export function NarrowInvestmentSection({
  holding,
  redeem,
  onActionSuccess,
}: {
  holding: IEarnPositionView;
  redeem?: IEarnHoldingRedeem;
  onActionSuccess?: () => void;
}) {
  const intl = useIntl();
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
      <HoldingInvestmentGrid holding={holding} m="$-5" p="$2" />
      {holding.meta?.kind === 'healthFactor' ? (
        <EarnPositionHealthFactorRow meta={holding.meta} />
      ) : null}
      <PortfolioPendingTxsProvider value={pendingTxsValue}>
        <EarnHoldingSections position={holding} redeem={redeem} />
      </PortfolioPendingTxsProvider>
    </YStack>
  );
}
