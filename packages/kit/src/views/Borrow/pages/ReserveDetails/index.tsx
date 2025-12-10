import { memo, useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IApyHistoryItem,
  IBorrowReserveDetail,
} from '@onekeyhq/shared/types/staking';

import { ApyChartBase } from '../../../Staking/components/ApyChartBase';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../../Staking/components/PageFrame';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '../../../Staking/components/ProtocolDetails/GridItemV2';
import { OverviewSkeleton } from '../../../Staking/components/StakingSkeleton';
import { useEarnAccount } from '../../hooks/useEarnAccount';

interface IReserveHeaderProps {
  symbol: string;
  logoURI?: string;
  supplyApy?: string;
  borrowApy?: string;
}

const ReserveHeader = ({
  symbol,
  logoURI,
  supplyApy,
  borrowApy,
}: IReserveHeaderProps) => (
  <YStack gap="$3">
    <XStack gap="$2" ai="center">
      <Token size="md" tokenImageUri={logoURI} />
      <SizableText size="$headingXl">{symbol}</SizableText>
    </XStack>

    <XStack gap="$6">
      <YStack>
        <SizableText size="$bodySm" color="$textSubdued">
          Supply APY
        </SizableText>
        <SizableText size="$headingLg" color="$textSuccess">
          {supplyApy ?? '-'}
        </SizableText>
      </YStack>
      <YStack>
        <SizableText size="$bodySm" color="$textSubdued">
          Borrow APY
        </SizableText>
        <SizableText size="$headingLg" color="$textCaution">
          {borrowApy ?? '-'}
        </SizableText>
      </YStack>
    </XStack>
  </YStack>
);

interface IChartSectionProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}

function ChartSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: IChartSectionProps) {
  const { result: apyHistory, isLoading } = usePromiseResult(
    async () => {
      const apyHistoryItems =
        await backgroundApiProxy.serviceStaking.getBorrowApyHistory({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          days: 'month',
        });

      return apyHistoryItems.items ?? [];
    },
    [networkId, provider, marketAddress, reserveAddress],
    { watchLoading: true },
  );

  const { supplyHistory, borrowHistory } = useMemo(() => {
    if (isEmpty(apyHistory)) {
      return { supplyHistory: [], borrowHistory: [] };
    }
    const supply: IApyHistoryItem[] = [];
    const borrow: IApyHistoryItem[] = [];
    apyHistory?.forEach((item) => {
      supply.push({
        apy: item.supplyApy,
        timestamp: item.timestamp,
      });
      borrow.push({
        apy: item.borrowApy,
        timestamp: item.timestamp,
      });
    });

    return { supplyHistory: supply, borrowHistory: borrow };
  }, [apyHistory]);

  return (
    <YStack gap="$6" pt="$4">
      <ApyChartBase
        title="Supply APY"
        data={supplyHistory}
        isLoading={isLoading}
      />
      <ApyChartBase
        title="Borrow APY"
        data={borrowHistory}
        isLoading={isLoading}
      />
    </YStack>
  );
}

interface IReserveInfoSectionProps {
  details: IBorrowReserveDetail | undefined;
}

const ReserveInfoSection = ({ details }: IReserveInfoSectionProps) => {
  if (!details) return null;

  return (
    <YStack gap="$6">
      <EarnText text={{ text: 'Reserve Info' }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: 'Reserve Size' }}
          description={{ text: details.reserveSize ?? '-' }}
        />
        <GridItem
          title={{ text: 'Utilization Ratio' }}
          description={{ text: details.utilizationRatio ?? '-' }}
        />
        <GridItem
          title={{ text: 'Available Liquidity' }}
          description={{ text: details.liquidity ?? '-' }}
        />
        <GridItem
          title={{ text: 'Oracle Price' }}
          description={{ text: details.oraclePrice ?? '-' }}
        />
      </XStack>
      <Divider />
    </YStack>
  );
};

interface IUserInfoSectionProps {
  userInfo: IBorrowReserveDetail['userInfo'] | undefined;
}

const UserInfoSection = ({ userInfo }: IUserInfoSectionProps) => {
  if (!userInfo) return null;

  return (
    <YStack gap="$6">
      <EarnText text={{ text: 'Your Info' }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: 'Wallet Balance' }}
          description={{ text: userInfo.walletBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Supplied Balance' }}
          description={{ text: userInfo.suppliedBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Borrowed Balance' }}
          description={{ text: userInfo.borrowedBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Available to Borrow' }}
          description={{ text: userInfo.availableBorrowBalance ?? '-' }}
        />
      </XStack>
      <Divider />
    </YStack>
  );
};

interface IDetailsPartProps {
  details: IBorrowReserveDetail | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
}

const DetailsPartComponent = ({
  details,
  isLoading,
  onRefresh,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
}: IDetailsPartProps) => (
  <YStack flex={6} gap="$5" px="$5">
    <PageFrame
      LoadingSkeleton={OverviewSkeleton}
      loading={isLoadingState({ result: details, isLoading })}
      error={isErrorState({ result: details, isLoading })}
      onRefresh={onRefresh}
    >
      {details ? (
        <YStack gap="$8">
          <YStack>
            <ReserveHeader
              symbol={symbol}
              logoURI={logoURI}
              supplyApy={details.supply?.apyDetail?.apy}
              borrowApy={details.borrow?.apyDetail?.apy}
            />
            <ChartSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
            />
          </YStack>
          <ReserveInfoSection details={details} />
          <UserInfoSection userInfo={details.userInfo} />
        </YStack>
      ) : null}
    </PageFrame>
  </YStack>
);

const DetailsPart = memo(DetailsPartComponent);

interface IManagePositionPartProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}

const ManagePositionPart = ({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: IManagePositionPartProps) => (
  // TODO: Implement ManagePosition for Borrow
  // - Add supply/withdraw actions
  // - Add borrow/repay actions
  <YStack flex={4}>
    <YStack gap="$1.5" flex={1} p="$5">
      <YStack
        p="$4"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
        gap="$4"
      >
        <SizableText size="$headingMd">Manage Position</SizableText>
        <YStack gap="$3">
          <SizableText size="$bodySm" color="$textSubdued">
            TODO: Supply / Withdraw
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            TODO: Borrow / Repay
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            networkId: {networkId}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            provider: {provider}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            marketAddress: {marketAddress}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            reserveAddress: {reserveAddress}
          </SizableText>
        </YStack>
      </YStack>
    </YStack>
  </YStack>
);

const ReserveDetailsPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    ITabEarnParamList,
    ETabEarnRoutes.BorrowReserveDetails
  >();
  const { gtMd } = useMedia();

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  } = route.params;

  const { earnAccount } = useEarnAccount({ networkId });
  const accountId = earnAccount?.account?.id || '';

  const {
    result: details,
    isLoading,
    run: refreshData,
  } = usePromiseResult(
    async () => {
      if (!accountId) return undefined;
      return backgroundApiProxy.serviceStaking.getBorrowReserveDetails({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        accountId,
      });
    },
    [networkId, provider, marketAddress, reserveAddress, accountId],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const pageFooter = useMemo(() => {
    if (gtMd) return null;
    // TODO: Add footer buttons for mobile (Supply / Borrow)
    return (
      <Page.Footer
        onConfirmText="Supply"
        confirmButtonProps={{
          variant: 'primary',
          onPress: () => {
            // TODO: Navigate to supply page
          },
        }}
        onCancelText="Borrow"
        cancelButtonProps={{
          onPress: () => {
            // TODO: Navigate to borrow page
          },
        }}
      />
    );
  }, [gtMd]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_symbol },
          { symbol },
        )}
      />
      <Page.Body pb="$5">
        <YStack px="$5" gap="$8">
          <XStack flexDirection={gtMd ? 'row' : 'column'}>
            <Stack w="100%" width={gtMd ? '65%' : undefined}>
              <DetailsPart
                details={details}
                isLoading={isLoading ?? false}
                onRefresh={refreshData}
                networkId={networkId}
                provider={provider}
                marketAddress={marketAddress}
                reserveAddress={reserveAddress}
                symbol={symbol}
                logoURI={logoURI}
              />
            </Stack>
            {gtMd ? (
              <Stack width="35%">
                <ManagePositionPart
                  networkId={networkId}
                  provider={provider}
                  marketAddress={marketAddress}
                  reserveAddress={reserveAddress}
                />
              </Stack>
            ) : null}
          </XStack>
        </YStack>
      </Page.Body>
      {pageFooter}
    </Page>
  );
};

function ReserveDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReserveDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ReserveDetailsPageWithProvider;
