import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Dialog,
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
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  ILidoEthOverview,
  ILidoEthRequest,
} from '@onekeyhq/shared/types/staking';

import { EthLidoFAQs } from '../../components/LidoFAQs';
import {
  EthStakeShouldUnderstand,
  EthWithdrawShouldUnderstand,
} from '../../components/LidoShouldUnderstand';
import { NftListItemStatus } from '../../components/NftListItemStatus';
import { PageSkeleton } from '../../components/PageSkeleton';
import { ProtocolIntro } from '../../components/ProtocolIntro';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { StakingProfit } from '../../components/StakingProfit';
import { useLidoClaim } from '../../hooks/useLidoEthHooks';
import {
  LIDO_ETH_LOGO_URI,
  LIDO_LOGO_URI,
  LIDO_OFFICIAL_URL,
} from '../../utils/const';

const ListItemPending = ({ requests }: { requests: ILidoEthRequest[] }) => {
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amountOfStETH), 0),
    [requests],
  );
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      symbol="ETH"
      status="pending"
      tokenImageUri={LIDO_ETH_LOGO_URI}
      amount={String(amount)}
    />
  );
};

const ListItemStaked = ({ amount }: { amount: string }) => (
  <NftListItemStatus
    amount={amount}
    symbol="ETH"
    status="staked"
    tokenImageUri={LIDO_ETH_LOGO_URI}
  />
);

const ListItemClaim = ({
  requests,
  accountId,
  networkId,
}: {
  requests: ILidoEthRequest[];
  networkId: string;
  accountId: string;
}) => {
  const requestIds = useMemo(() => requests.map((o) => o.id), [requests]);
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amountOfStETH), 0),
    [requests],
  );
  const lidoClaim = useLidoClaim({ accountId, networkId });
  const onClaim = useCallback(async () => {
    await lidoClaim({
      requestIds,
      stakingInfo: {
        protocol: 'lido',
        tags: ['lido-eth'],
      },
    });
  }, [lidoClaim, requestIds]);
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      onClaim={onClaim}
      symbol="ETH"
      status="claimable"
      tokenImageUri={LIDO_ETH_LOGO_URI}
      amount={String(amount)}
    />
  );
};

type IEthLidoOverviewContentProps = {
  networkId: string;
  accountId: string;
  overview: ILidoEthOverview;
  apr?: number;
  onRefresh?: () => void;
};

const EthLidoOverviewContent = ({
  accountId,
  networkId,
  overview,
  apr = 4,
  onRefresh,
}: IEthLidoOverviewContentProps) => {
  const { eth, stETH, requests } = overview;
  const appNavigation = useAppNavigation();

  const onStake = useCallback(async () => {
    Dialog.show({
      renderContent: <EthStakeShouldUnderstand />,
      onConfirm: () => {
        appNavigation.push(EModalStakingRoutes.EthLidoStake, {
          accountId,
          networkId,
          balance: eth.balanceParsed,
          price: eth.price,
          token: eth.info,
          stToken: stETH.info,
          apr,
        });
      },
      onConfirmText: 'Got it!',
      showCancelButton: false,
    });
  }, [appNavigation, accountId, networkId, eth, apr, stETH]);
  const onWithdraw = useCallback(async () => {
    Dialog.show({
      renderContent: <EthWithdrawShouldUnderstand />,
      showCancelButton: false,
      onConfirmText: 'Got it!',
      onConfirm: () => {
        appNavigation.push(EModalStakingRoutes.EthLidoWithdraw, {
          accountId,
          networkId,
          balance: stETH.balanceParsed,
          price: stETH.price,
          token: stETH.info,
          receivingToken: eth.info,
        });
      },
    });
  }, [accountId, networkId, appNavigation, stETH, eth]);

  const showRedeemButton = useMemo(
    () => new BigNumber(stETH.balanceParsed).gt(0),
    [stETH.balanceParsed],
  );

  const totalFiatValue = useMemo(
    () => BigNumber(stETH.balanceParsed).multipliedBy(stETH.price).toFixed(),
    [stETH],
  );

  const nfts = useMemo(() => {
    const pending = requests.filter((o) => !o.isFinalized);
    const finished = requests.filter((o) => o.isFinalized && !o.isClaimed);
    return { pending, finished };
  }, [requests]);

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  return (
    <Stack px="$5">
      <YStack>
        <SizableText size="$headingLg">Staked Value</SizableText>
        <NumberSizeableText
          size="$heading3xl"
          formatter="value"
          formatterOptions={{ currency: symbol }}
        >
          {totalFiatValue}
        </NumberSizeableText>
        <XStack mt="$2" space="$1">
          <NumberSizeableText size="$bodyMd" formatter="value">
            {eth.balanceParsed}
          </NumberSizeableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {eth.info.symbol} available to stake
          </SizableText>
        </XStack>
        <YStack space="$2" mt="$5">
          <ListItemStaked amount={stETH.balanceParsed} />
          <ListItemPending requests={nfts.pending} />
          <ListItemClaim
            accountId={accountId}
            networkId={networkId}
            requests={nfts.finished}
          />
        </YStack>
        <ProtocolIntro
          protocolText="Lido"
          protocolLogoUrl={LIDO_LOGO_URI}
          externalUrl={LIDO_OFFICIAL_URL}
        />
        <StakingProfit
          apr={apr}
          tokenImageUrl={eth.info.logoURI}
          tokenSymbol={eth.info.symbol}
        />
        <EthLidoFAQs />
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
                onPress: onWithdraw,
              }
            : undefined
        }
      />
      <StakingTransactionIndicator
        accountId={accountId}
        networkId={networkId}
        stakeTag="lido-eth"
        onRefresh={onRefresh}
      />
    </Stack>
  );
};

const EthLidoOverview = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoOverview
  >();
  const { accountId, networkId } = appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const overviewPromise =
        backgroundApiProxy.serviceStaking.fetchLidoEthOverview({
          accountId,
          networkId,
        });
      const aprPromise = backgroundApiProxy.serviceStaking.getApr('eth');
      const [overview, apr] = await Promise.all([overviewPromise, aprPromise]);
      return { overview, apr };
    },
    [accountId, networkId],
    { watchLoading: true },
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Stake ETH" />
      <Page.Body>
        <PageSkeleton
          loading={Boolean(result === undefined && isLoading === true)}
          error={Boolean(result === undefined && isLoading === false)}
          onRefresh={run}
        >
          {result ? (
            <EthLidoOverviewContent
              overview={result.overview}
              apr={result.apr.find((o) => o.protocol === 'lido')?.apr}
              networkId={networkId}
              accountId={accountId}
              onRefresh={run}
            />
          ) : null}
        </PageSkeleton>
      </Page.Body>
    </Page>
  );
};

export default EthLidoOverview;
