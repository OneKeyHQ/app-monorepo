import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Button,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  ILidoEthOverview,
  ILidoEthRequest,
} from '@onekeyhq/shared/types/staking';

import { ProtocolIntro } from '../../components/ProtocolIntro';
import { StakingProfit } from '../../components/StakingProfit';
import { useLidoClaim } from '../../hooks/useLidoEthHooks';

type INftStatus = 'pending' | 'claimable' | 'staked';

type INftListItemStatusProps = {
  symbol: string;
  amount: string;
  tokenImageUri: string;
  confirmText?: string;
  status: INftStatus;
  onClaim?: () => void;
};

const NftListItemStatus = ({
  amount,
  symbol,
  tokenImageUri,
  onClaim,
  status,
}: INftListItemStatusProps) => {
  const statusText = useMemo(() => {
    const statuses: Record<INftStatus, string> = {
      'claimable': 'claimable',
      'pending': 'pending',
      'staked': 'staked',
    };
    return statuses[status];
  }, [status]);
  return (
    <XStack justifyContent="space-between">
      <XStack space="$1">
        <Token size="sm" tokenImageUri={tokenImageUri} />
        <NumberSizeableText size="$bodyLgMedium" formatter="balance">
          {amount}
        </NumberSizeableText>
        <SizableText size="$bodyLgMedium">{symbol}</SizableText>
        <SizableText size="$bodyLg">is {statusText}</SizableText>
      </XStack>
      {onClaim ? (
        <Button size="small" onPress={onClaim}>
          Claim
        </Button>
      ) : null}
    </XStack>
  );
};

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
      symbol="stETH"
      status="pending"
      tokenImageUri="https://uni.onekey-asset.com/static/chain/eth.png"
      amount={String(amount)}
    />
  );
};

const ListItemStaked = ({ amount }: { amount: string }) => (
  <NftListItemStatus
    amount={amount}
    symbol="ETH"
    status="staked"
    tokenImageUri="https://uni.onekey-asset.com/static/chain/eth.png"
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
  const lidoClaim = useLidoClaim();
  const onClaim = useCallback(async () => {
    await lidoClaim({ accountId, networkId, requestIds });
  }, [accountId, networkId, lidoClaim, requestIds]);
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      onClaim={onClaim}
      symbol="stETH"
      status="claimable"
      tokenImageUri="https://uni.onekey-asset.com/static/chain/eth.png"
      amount={String(amount)}
    />
  );
};

const EthLidoOverviewContent = ({
  accountId,
  networkId,
  overview,
  apr = 4,
}: {
  networkId: string;
  accountId: string;
  overview: ILidoEthOverview;
  apr?: number;
}) => {
  const { eth, stETH, requests } = overview;
  const appNavigation = useAppNavigation();
  const onStake = useCallback(async () => {
    appNavigation.push(EModalStakingRoutes.EthLidoStake, {
      accountId,
      networkId,
      balance: eth.balanceParsed,
      price: eth.price,
      token: eth.info,
    });
  }, [appNavigation, accountId, networkId, eth]);
  const onWithdraw = useCallback(async () => {
    appNavigation.push(EModalStakingRoutes.EthLidoWithdraw, {
      accountId,
      networkId,
      balance: stETH.balanceParsed,
      token: stETH.info,
    });
  }, [accountId, networkId, appNavigation, stETH]);

  const showRedeemButton = useMemo(
    () => new BigNumber(stETH.balanceParsed).gt(0),
    [stETH.balanceParsed],
  );

  const totalFiatValue = useMemo(
    () => BigNumber(stETH.balanceParsed).multipliedBy(stETH.price).toFixed(),
    [stETH],
  );

  const nfts = useMemo(() => {
    const unfinished = requests.filter((o) => !o.isFinalized);
    const finished = requests.filter((o) => o.isFinalized);
    return { pending: unfinished, finished };
  }, [requests]);

  return (
    <Stack px="$5">
      <YStack>
        <SizableText size="$headingLg">Staked Value</SizableText>
        <NumberSizeableText size="$heading3xl" formatter="value">
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
          <ListItemPending requests={nfts.finished} />
          <ListItemClaim
            accountId={accountId}
            networkId={networkId}
            requests={nfts.finished}
          />
        </YStack>
        <ProtocolIntro
          protocolText="Lido"
          protocolLogoUrl="https://uni.onekey-asset.com/static/logo/Lido.png"
        />
        <StakingProfit
          apr={apr}
          tokenImageUrl="https://uni.onekey-asset.com/static/chain/eth.png"
          tokenSymbol="ETH"
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
                onPress: onWithdraw,
              }
            : undefined
        }
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
  const { result } = usePromiseResult(async () => {
    const overviewPromise =
      backgroundApiProxy.serviceStaking.fetchLidoEthOverview({
        accountId,
        networkId,
      });
    const aprPromise = backgroundApiProxy.serviceStaking.getApr('eth');
    const [overview, apr] = await Promise.all([overviewPromise, aprPromise]);
    return { overview, apr };
  }, [accountId, networkId]);
  return (
    <Page scrollEnabled>
      <Page.Header title="Stake ETH" />
      <Page.Body>
        {result ? (
          <EthLidoOverviewContent
            overview={result.overview}
            apr={result.apr.find((o) => o.protocol === 'Lido')?.apr}
            networkId={networkId}
            accountId={accountId}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
};

export default EthLidoOverview;
