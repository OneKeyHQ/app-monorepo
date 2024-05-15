import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { ILidoMaticOverview } from '@onekeyhq/shared/types/staking';

import { ProtocolIntro } from '../../components/ProtocolIntro';
import { StakingProfit } from '../../components/StakingProfit';

type IMaticLidoOverviewContentProps = {
  networkId: string;
  accountId: string;
  overview: ILidoMaticOverview;
  apr?: number;
};

const MaticLidoOverviewContent = ({
  networkId,
  accountId,
  overview,
  apr = 4,
}: IMaticLidoOverviewContentProps) => {
  const { matic, stMatic } = overview;
  const appNavigation = useAppNavigation();
  const onStake = useCallback(async () => {
    appNavigation.push(EModalStakingRoutes.MaticLidoStake, {
      accountId,
      networkId,
      balance: matic.balanceParsed,
      price: matic.price,
      token: matic.info,
    });
  }, [appNavigation, accountId, networkId, matic]);
  const onRedeem = useCallback(async () => {
    appNavigation.push(EModalStakingRoutes.MaticLidoWithdraw, {
      accountId,
      networkId,
      balance: stMatic.balanceParsed,
      token: stMatic.info,
    });
  }, [accountId, networkId, appNavigation, stMatic]);

  const showRedeemButton = useMemo(
    () => new BigNumber(stMatic.balanceParsed).gt(0),
    [stMatic.balanceParsed],
  );

  const totalFiatValue = useMemo(
    () =>
      BigNumber(stMatic.balanceParsed).multipliedBy(stMatic.price).toFixed(),
    [stMatic],
  );

  return (
    <Stack px="$5">
      <YStack>
        <Stack>
          <SizableText size="$headingLg">Staked Value</SizableText>
          <NumberSizeableText size="$heading3xl" formatter="value">
            {totalFiatValue}
          </NumberSizeableText>
        </Stack>
        <XStack mt="$2" space="$1">
          <NumberSizeableText size="$bodyMd" formatter="balance">
            {matic.balanceParsed}
          </NumberSizeableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {matic.info.symbol} available to stake
          </SizableText>
        </XStack>
        <ProtocolIntro
          protocolText="Lido"
          protocolLogoUrl="https://uni.onekey-asset.com/static/logo/Lido.png"
        />
        <StakingProfit
          apr={apr}
          tokenImageUrl="https://uni.onekey-asset.com/static/chain/polygon.png"
          tokenSymbol="Matic"
        />
      </YStack>
      <Page.Footer
        onConfirmText="Stake"
        confirmButtonProps={{
          variant: 'primary',
          onPress: onStake,
        }}
        onCancelText="Redeem"
        cancelButtonProps={
          showRedeemButton
            ? {
                onPress: onRedeem,
              }
            : undefined
        }
      />
    </Stack>
  );
};

const MaticLidoOverview = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoOverview
  >();
  const { accountId, networkId } = appRoute.params;
  const { result } = usePromiseResult(async () => {
    const overviewPromise =
      backgroundApiProxy.serviceStaking.fetchLidoMaticOverview({
        accountId,
        networkId,
      });
    const aprPromise = backgroundApiProxy.serviceStaking.getApr('matic');
    const [overview, apr] = await Promise.all([overviewPromise, aprPromise]);
    return { overview, apr };
  }, [accountId, networkId]);
  return (
    <Page scrollEnabled>
      <Page.Header title="Stake Matic" />
      <Page.Body>
        {result ? (
          <MaticLidoOverviewContent
            accountId={accountId}
            networkId={networkId}
            overview={result.overview}
            apr={result.apr[0]?.apr}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
};

export default MaticLidoOverview;
