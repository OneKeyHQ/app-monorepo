import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Toast, YStack } from '@onekeyhq/components';
import { PortfolioTotalsHeader } from '@onekeyhq/kit/src/views/Earn/pages/EarnPositions/mobile/PortfolioTotalsHeader';
import type { IEarnPositionCardHandlers } from '@onekeyhq/kit/src/views/Earn/pages/EarnPositions/positionModel/EarnPositionCard';
import {
  buildEarnClaimableRewardsView,
  buildEarnPortfolioView,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnPositions/positionModel/earnPositionModel';
import { EARN_PORTFOLIO_POSITIONS_FIXTURE } from '@onekeyhq/kit/src/views/Earn/pages/EarnPositions/positionModel/earnPositionModel.fixtures';
import { EarnPositionProtocolList } from '@onekeyhq/kit/src/views/Earn/pages/EarnPositions/positionModel/EarnPositionProtocolList';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { Layout } from './utils/Layout';

const handlers: IEarnPositionCardHandlers = {
  onManage: (target) => {
    Toast.message({
      title: `Manage → ${target.provider} · ${target.symbol} · ${target.networkId}`,
    });
  },
  onClaim: (position) => {
    Toast.message({ title: `Claim → ${position.key}` });
  },
};

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      width="100%"
      maxWidth={393}
      py="$2"
      bg="$bgApp"
      borderRadius="$4"
      borderWidth="$px"
      borderColor="$borderSubdued"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function useFixtureView() {
  const intl = useIntl();
  return useMemo(() => {
    const translate = (id: ETranslations) => intl.formatMessage({ id });
    const portfolio = buildEarnPortfolioView({
      response: EARN_PORTFOLIO_POSITIONS_FIXTURE,
      translate,
    });
    const claimable = buildEarnClaimableRewardsView(portfolio.protocols);
    const claimableTotal = claimable.reduce(
      (sum, protocol) => sum + protocol.value.value,
      0,
    );
    return { portfolio, claimable, claimableTotal };
  }, [intl]);
}

function DeFiAssetsExample() {
  const { portfolio, claimableTotal } = useFixtureView();
  return (
    <PhoneFrame>
      <PortfolioTotalsHeader
        defiAssetsFiatValue={String(portfolio.totalValue)}
        rewardsFiatValue={String(claimableTotal)}
      />
      <EarnPositionProtocolList
        protocols={portfolio.protocols}
        expandAll
        {...handlers}
      />
    </PhoneFrame>
  );
}

function ClaimableRewardsExample() {
  const { claimable } = useFixtureView();
  return (
    <PhoneFrame>
      <EarnPositionProtocolList protocols={claimable} expandAll {...handlers} />
    </PhoneFrame>
  );
}

const EarnPositionModelGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="EarnPositionModel"
    description="My portfolio (OK-61377) rendered from the reference position contract: the wallet DeFi Portfolio model, one card per groupId, protocol rows per network"
    suggestions={[
      'Data: EARN_PORTFOLIO_POSITIONS_FIXTURE (earnPositionModel.fixtures.ts), the shape the earn service should return',
      'Doc: docs/earn-my-portfolio-position-model.md',
    ]}
    elements={[
      {
        title: 'DeFi Assets',
        element: <DeFiAssetsExample />,
      },
      {
        title: 'Rewards · Claimable (protocol rewards only)',
        element: (
          <YStack gap="$3">
            <SizableText size="$bodyMd" color="$textSubdued">
              Card and row figures are the rewards, never the principal. Ledger
              rewards (POST /earn/v1/rewards/portfolio) list below these on the
              page.
            </SizableText>
            <ClaimableRewardsExample />
          </YStack>
        ),
      },
    ]}
  />
);

export default EarnPositionModelGallery;
