import { useCallback, useMemo, useState } from 'react';

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
  ILidoMaticOverview,
  ILidoMaticRequest,
} from '@onekeyhq/shared/types/staking';

import {
  MaticStakeShouldUnderstand,
  MaticWithdrawShouldUnderstand,
} from '../../components/LidoShouldUnderstand';
import { NftListItemStatus } from '../../components/NftListItemStatus';
import { PageSkeleton } from '../../components/PageSkeleton';
import { ProtocolIntro } from '../../components/ProtocolIntro';
import { StakingProfit } from '../../components/StakingProfit';
import { useLidoMaticClaim } from '../../hooks/useLidoMaticHooks';
import {
  LIDO_LOGO_URI,
  LIDO_MATIC_LOGO_URI,
  LIDO_OFFICIAL_URL,
} from '../../utils/const';

const ListItemStaked = ({ amount }: { amount: string }) => (
  <NftListItemStatus
    amount={amount}
    symbol="MATIC"
    status="staked"
    tokenImageUri={LIDO_MATIC_LOGO_URI}
  />
);

const ListItemPending = ({ requests }: { requests: ILidoMaticRequest[] }) => {
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amount), 0),
    [requests],
  );
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      amount={String(amount)}
      symbol="MATIC"
      status="pending"
      tokenImageUri={LIDO_MATIC_LOGO_URI}
    />
  );
};

const ListItemClaim = ({
  requests,
  accountId,
  networkId,
}: {
  requests: ILidoMaticRequest[];
  accountId: string;
  networkId: string;
}) => {
  const lidoClaim = useLidoMaticClaim({ accountId, networkId });
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amount), 0),
    [requests],
  );
  const onClaim = useCallback(async () => {
    await lidoClaim({ tokenId: Number(requests[0].id) });
  }, [lidoClaim, requests]);
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      onClaim={onClaim}
      amount={String(amount)}
      symbol="MATIC"
      status="claimable"
      tokenImageUri={LIDO_MATIC_LOGO_URI}
    />
  );
};

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
  const { matic, stMatic, requests, matic2StMatic } = overview;
  const appNavigation = useAppNavigation();
  const [loading, setLoading] = useState<boolean>(false);
  const onStake = useCallback(async () => {
    Dialog.show({
      renderContent: <MaticStakeShouldUnderstand />,
      showCancelButton: false,
      onConfirmText: 'Got it!',
      onConfirm: async ({ close }) => {
        setLoading(true);
        try {
          await close();
          const { allowanceParsed } =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              accountId,
              networkId,
              spenderAddress: stMatic.info.address,
              tokenAddress: matic.info.address,
            });
          appNavigation.push(EModalStakingRoutes.MaticLidoStake, {
            accountId,
            networkId,
            balance: matic.balanceParsed,
            price: matic.price,
            token: matic.info,
            stToken: stMatic.info,
            currentAllowance: allowanceParsed,
            rate: matic2StMatic,
            apr,
          });
        } finally {
          setLoading(false);
        }
      },
    });
  }, [appNavigation, accountId, networkId, matic, apr, stMatic, matic2StMatic]);
  const onRedeem = useCallback(async () => {
    Dialog.show({
      renderContent: <MaticWithdrawShouldUnderstand />,
      showCancelButton: false,
      onConfirmText: 'Got it!',
      onConfirm: () => {
        appNavigation.push(EModalStakingRoutes.MaticLidoWithdraw, {
          accountId,
          networkId,
          balance: stMatic.balanceParsed,
          token: stMatic.info,
        });
      },
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

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const nfts = useMemo(() => {
    const pending = requests.filter((o) => !o.claimable);
    const finished = requests.filter((o) => o.claimable);
    return { pending, finished };
  }, [requests]);

  return (
    <Stack px="$5">
      <YStack>
        <Stack>
          <SizableText size="$headingLg">Staked Value</SizableText>
          <NumberSizeableText
            size="$heading3xl"
            formatter="value"
            formatterOptions={{ currency: symbol }}
          >
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
        <YStack space="$2" mt="$5">
          <ListItemStaked amount={stMatic.balanceParsed} />
          <ListItemPending requests={nfts.pending} />
          <ListItemClaim
            requests={nfts.finished}
            accountId={accountId}
            networkId={networkId}
          />
        </YStack>
        <ProtocolIntro
          protocolText="Lido"
          protocolLogoUrl={LIDO_LOGO_URI}
          externalUrl={LIDO_OFFICIAL_URL}
        />
        <StakingProfit
          apr={apr}
          tokenImageUrl={matic.info.logoURI}
          tokenSymbol={matic.info.symbol}
        />
      </YStack>
      <Page.Footer
        onConfirmText="Stake"
        confirmButtonProps={{
          loading,
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
  const [refreshValue, setRefreshValue] = useState(1);
  const onRefresh = useCallback(() => setRefreshValue((v) => v + 1), []);
  const { result, isLoading } = usePromiseResult(
    async () => {
      const overviewPromise =
        backgroundApiProxy.serviceStaking.fetchLidoMaticOverview({
          accountId,
          networkId,
        });
      const aprPromise = backgroundApiProxy.serviceStaking.getApr('matic');
      const [overview, apr] = await Promise.all([overviewPromise, aprPromise]);
      return { overview, apr };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, networkId, refreshValue],
    { watchLoading: true },
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Stake MATIC" />
      <Page.Body>
        <PageSkeleton
          loading={Boolean(result === undefined && isLoading === true)}
          error={Boolean(result === undefined && isLoading === false)}
          onRefresh={onRefresh}
        >
          {result ? (
            <MaticLidoOverviewContent
              accountId={accountId}
              networkId={networkId}
              overview={result.overview}
              apr={result.apr[0]?.apr}
            />
          ) : null}
        </PageSkeleton>
      </Page.Body>
    </Page>
  );
};

export default MaticLidoOverview;
