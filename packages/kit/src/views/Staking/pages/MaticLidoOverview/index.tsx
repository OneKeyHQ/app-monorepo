import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import {
  ELidoLabels,
  type ILidoMaticOverview,
  type ILidoMaticRequest,
  type ILidoTokenItem,
} from '@onekeyhq/shared/types/staking';

import { MaticLidoFAQs } from '../../components/LidoFAQs';
import {
  MaticStakeShouldUnderstand,
  MaticWithdrawShouldUnderstand,
} from '../../components/LidoShouldUnderstand';
import { NftListItemStatus } from '../../components/NftListItemStatus';
import { PageFrame } from '../../components/PageFrame';
import { ProtocolIntro } from '../../components/ProtocolIntro';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { StakingProfit } from '../../components/StakingProfit';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useLidoMaticClaim } from '../../hooks/useLidoMaticHooks';
import {
  LIDO_LOGO_URI,
  LIDO_MATIC_LOGO_URI,
  LIDO_OFFICIAL_URL,
} from '../../utils/const';

const ListItemStaked = ({
  amount,
  matic2StMatic,
}: {
  amount: string;
  matic2StMatic: string;
}) => {
  const amountString = BigNumber(amount).div(matic2StMatic).toFixed();
  return (
    <NftListItemStatus
      amount={amountString}
      symbol="MATIC"
      status="staked"
      tokenImageUri={LIDO_MATIC_LOGO_URI}
    />
  );
};

const ListItemPending = ({
  requests,
  matic2StMatic,
}: {
  requests: ILidoMaticRequest[];
  matic2StMatic: string;
}) => {
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amount), 0),
    [requests],
  );
  if (requests.length === 0) {
    return null;
  }
  const amountString = BigNumber(amount).div(matic2StMatic).toFixed();
  return (
    <NftListItemStatus
      amount={amountString}
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
  token,
  matic2StMatic,
}: {
  requests: ILidoMaticRequest[];
  accountId: string;
  networkId: string;
  token: ILidoTokenItem;
  matic2StMatic: string;
}) => {
  const appNavigation = useAppNavigation();
  const lidoClaim = useLidoMaticClaim({ accountId, networkId });
  const amount = useMemo(
    () => requests.reduce((a, b) => a + Number(b.amount), 0),
    [requests],
  );
  const amountString = BigNumber(amount).div(matic2StMatic).toFixed();
  const onClaim = useCallback(async () => {
    if (requests.length === 1) {
      await lidoClaim({
        tokenId: Number(requests[0].id),
        stakingInfo: {
          label: ELidoLabels.Claim,
          protocol: 'lido',
          tags: ['lido-matic'],
          receive: { token: token.info, amount: String(amount) },
        },
      });
    } else {
      appNavigation.push(EModalStakingRoutes.MaticLidoClaim, {
        accountId,
        networkId,
        requests,
        token: token.info,
      });
    }
  }, [lidoClaim, requests, appNavigation, accountId, networkId, token, amount]);
  if (requests.length === 0) {
    return null;
  }
  return (
    <NftListItemStatus
      onClaim={onClaim}
      amount={String(amountString)}
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
  onRefresh?: () => void;
};

const MaticLidoOverviewContent = ({
  networkId,
  accountId,
  overview,
  apr = 4,
  onRefresh,
}: IMaticLidoOverviewContentProps) => {
  const { matic, stMatic, requests, matic2StMatic } = overview;
  const appNavigation = useAppNavigation();
  const intl = useIntl();
  const [loading, setLoading] = useState<boolean>(false);
  const onStake = useCallback(async () => {
    Dialog.show({
      renderContent: <MaticStakeShouldUnderstand apr={apr} />,
      showCancelButton: false,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
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
  }, [
    appNavigation,
    accountId,
    networkId,
    matic,
    apr,
    stMatic,
    matic2StMatic,
    intl,
  ]);
  const onRedeem = useCallback(async () => {
    Dialog.show({
      renderContent: <MaticWithdrawShouldUnderstand />,
      showCancelButton: false,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
      onConfirm: () => {
        appNavigation.push(EModalStakingRoutes.MaticLidoWithdraw, {
          accountId,
          networkId,
          balance: stMatic.balanceParsed,
          price: stMatic.price,
          token: stMatic.info,
          receivingToken: matic.info,
          rate: matic2StMatic,
        });
      },
    });
  }, [
    accountId,
    networkId,
    appNavigation,
    stMatic,
    matic,
    matic2StMatic,
    intl,
  ]);

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
    <Stack>
      <YStack px="$5" pt="$5">
        <Stack>
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.earn_staked_value })}
          </SizableText>
          <NumberSizeableText
            size="$heading3xl"
            formatter="value"
            formatterOptions={{ currency: symbol }}
          >
            {totalFiatValue}
          </NumberSizeableText>
        </Stack>
        <XStack mt="$2" space="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.earn_token_available_to_stake },
              {
                'token': (
                  <SizableText>
                    <NumberSizeableText size="$bodyMd" formatter="balance">
                      {matic.balanceParsed}
                    </NumberSizeableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {' '}
                      {matic.info.symbol}
                    </SizableText>
                  </SizableText>
                ),
              },
            )}
          </SizableText>
        </XStack>
        <YStack space="$2" mt="$5">
          <ListItemStaked
            amount={stMatic.balanceParsed}
            matic2StMatic={matic2StMatic}
          />
          <ListItemPending
            requests={nfts.pending}
            matic2StMatic={matic2StMatic}
          />
          <ListItemClaim
            requests={nfts.finished}
            accountId={accountId}
            networkId={networkId}
            token={matic}
            matic2StMatic={matic2StMatic}
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
      <Stack>
        <MaticLidoFAQs />
      </Stack>
      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.earn_stake })}
        confirmButtonProps={{
          loading,
          variant: 'primary',
          onPress: onStake,
        }}
        onCancelText={intl.formatMessage({ id: ETranslations.earn_redeem })}
        cancelButtonProps={
          showRedeemButton
            ? {
                onPress: onRedeem,
              }
            : undefined
        }
      />
      <StakingTransactionIndicator
        accountId={accountId}
        networkId={networkId}
        stakeTag="lido-matic"
        onRefresh={onRefresh}
        onPress={() =>
          appNavigation.push(EModalStakingRoutes.MaticLidoHistory, {
            accountId,
            networkId,
          })
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
  const { result, isLoading, run } = usePromiseResult(
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
    [accountId, networkId],
    { watchLoading: true },
  );
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': 'MATIC' },
        )}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={OverviewSkeleton}
          loading={Boolean(result === undefined && isLoading === true)}
          error={Boolean(result === undefined && isLoading === false)}
          onRefresh={run}
        >
          {result ? (
            <MaticLidoOverviewContent
              accountId={accountId}
              networkId={networkId}
              overview={result.overview}
              apr={result.apr[0]?.apr}
              onRefresh={run}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default MaticLidoOverview;
