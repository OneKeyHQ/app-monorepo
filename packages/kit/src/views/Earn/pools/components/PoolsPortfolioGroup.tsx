import { useMemo } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPoolAsset,
  IPoolPositionView,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  getPoolPair,
  getPoolPairTitle,
  getPoolVersionLabel,
} from '../poolsFormat';
import { PoolsNavigation } from '../poolsNavigation';
import { canCollectPoolFees, usePoolCollect } from '../usePoolCollect';
import { UNISWAP_PROTOCOL, useUsdToFiat } from '../usePoolsPortfolio';

import { PoolPairIcon } from './PoolPairIcon';
import { PoolPositionStatus } from './PoolPositionCard';

import type { IPoolsPortfolioGroup } from '../usePoolsPortfolio';

function getPoolSubtitle(view: IPoolPositionView) {
  const fee = view.pool.isDynamicFee
    ? POOLS_COPY.dynamicFee
    : formatFeeTier(view.pool.feeTier);
  return `${getPoolVersionLabel(view.pool)} ${fee}`;
}

function FiatText({
  usd,
  size = '$bodyMdMedium',
  color,
  showPlus = false,
}: {
  usd: BigNumber.Value;
  size?:
    | '$bodySm'
    | '$bodySmMedium'
    | '$bodyMdMedium'
    | '$bodyLgMedium'
    | '$headingLg';
  color?: string;
  showPlus?: boolean;
}) {
  const currencyInfo = useCurrency();
  const toFiat = useUsdToFiat();
  return (
    <NumberSizeableTextWrapper
      hideValue
      size={size}
      color={color}
      formatter="value"
      formatterOptions={{
        currency: currencyInfo.symbol,
        showPlusMinusSigns: showPlus,
      }}
      numberOfLines={1}
    >
      {toFiat(usd)}
    </NumberSizeableTextWrapper>
  );
}

// iOS paints no hairline for a vertical Divider, as the protocol header notes
function VerticalRule() {
  return platformEnv.isNative ? (
    <Stack w={1} h="$5" mx="$3" bg="$border" />
  ) : (
    <Divider vertical h="$5" mx="$3" />
  );
}

/**
 * Desktop Positions tab: the protocol header and a row per LP position, in
 * the columns the other protocols use. A row opens the position.
 */
export function PoolsPortfolioGroup({
  group,
}: {
  group: IPoolsPortfolioGroup;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const isDesktopLayout = !platformEnv.isNative && media.gtSm;
  const { collect, collectingId } = usePoolCollect();

  const columns: ITableColumn<IPoolPositionView>[] = useMemo(
    () => [
      {
        key: 'deposits',
        label: intl.formatMessage({ id: ETranslations.earn_deposited }),
        flex: 1.5,
        priority: 5,
        render: (view) => (
          <XStack ai="center" gap="$3" flex={1} minWidth={0}>
            <PoolPairIcon
              pool={view.pool}
              size="sm"
              ringColor="$bgApp"
              showNetwork
            />
            <YStack gap="$1" flex={1} minWidth={0}>
              <XStack gap="$1" ai="center" flexWrap="wrap">
                <SizableText size="$bodyMdMedium" numberOfLines={1}>
                  {getPoolPairTitle(view.pool)}
                </SizableText>
                <FiatText
                  usd={view.valueUsd}
                  size="$bodySm"
                  color="$textSubdued"
                />
              </XStack>
              <XStack ai="center" gap="$3" flexWrap="wrap">
                <SizableText size="$bodySm" color="$textSubdued">
                  {getPoolSubtitle(view)}
                </SizableText>
                {/* Narrow rows drop the status column, so a position that
                    earns nothing says so before it is opened */}
                {!isDesktopLayout &&
                view.status !== EPoolPositionStatus.Active ? (
                  <PoolPositionStatus view={view} />
                ) : null}
              </XStack>
            </YStack>
          </XStack>
        ),
      },
      {
        key: 'earnings',
        label: intl.formatMessage({ id: ETranslations.earn_24h_earnings }),
        flex: 1,
        priority: 1,
        render: (view) => <FiatText usd={view.fees24hUsd} />,
      },
      {
        key: 'status',
        label: intl.formatMessage({ id: ETranslations.earn_asset_status }),
        flex: 1,
        priority: 3,
        render: (view) => <PoolPositionStatus view={view} />,
      },
      {
        key: 'claimable',
        label: intl.formatMessage({ id: ETranslations.earn_claimable }),
        flex: 1,
        priority: 3,
        render: (view) =>
          canCollectPoolFees(view) ? (
            <XStack ai="center" gap="$2" flexWrap="wrap">
              <FiatText usd={view.uncollectedFeesUsd} />
              <Button
                size="small"
                variant="secondary"
                loading={collectingId === view.position.id}
                onPress={() => void collect(view)}
                testID={`earn-pools-portfolio-collect-${view.position.id}`}
              >
                {intl.formatMessage({ id: ETranslations.earn_claim })}
              </Button>
            </XStack>
          ) : (
            <SizableText size="$bodyMdMedium">-</SizableText>
          ),
      },
    ],
    [collect, collectingId, intl, isDesktopLayout],
  );

  // Phone width on web: rows open in place like the other protocols' rows,
  // with the same figures, the claim and Manage / Details under them
  const expandable = useMemo(
    () =>
      isDesktopLayout
        ? undefined
        : {
            renderExpandedContent: (view: IPoolPositionView) => (
              <YStack gap="$5">
                <XStack ai="center" gap="$1">
                  <FiatText usd={view.fees24hUsd} size="$bodyLgMedium" />
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.earn_24h_earnings,
                    })}
                  </SizableText>
                </XStack>
                <PoolPositionStatus view={view} />
                {canCollectPoolFees(view) ? (
                  <XStack ai="center" jc="space-between" gap="$2">
                    <XStack ai="center" gap="$2" flex={1} minWidth={0}>
                      <FiatText usd={view.uncollectedFeesUsd} />
                      {/* The same word as this row's column on wide screens */}
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.earn_claimable,
                        })}
                      </SizableText>
                    </XStack>
                    <Button
                      size="small"
                      variant="secondary"
                      loading={collectingId === view.position.id}
                      onPress={() => void collect(view)}
                      testID={`earn-pools-portfolio-collect-${view.position.id}`}
                    >
                      {intl.formatMessage({ id: ETranslations.earn_claim })}
                    </Button>
                  </XStack>
                ) : null}
                <XStack gap="$3">
                  <Button
                    flex={1}
                    size="medium"
                    variant="secondary"
                    onPress={() =>
                      PoolsNavigation.pushPosition(navigation, view.position.id)
                    }
                    testID={`earn-pools-portfolio-manage-${view.position.id}`}
                  >
                    {intl.formatMessage({ id: ETranslations.global_manage })}
                  </Button>
                  <Button
                    flex={1}
                    size="medium"
                    variant="secondary"
                    onPress={() =>
                      PoolsNavigation.pushPoolDetails(navigation, view.pool.id)
                    }
                    testID={`earn-pools-portfolio-details-${view.position.id}`}
                  >
                    {intl.formatMessage({ id: ETranslations.global_details })}
                  </Button>
                </XStack>
              </YStack>
            ),
          },
    [collect, collectingId, intl, isDesktopLayout, navigation],
  );

  return (
    <YStack>
      <YStack px="$pagePadding" py="$3">
        <XStack ai="center">
          {/* Token puts margins on its image, inside the badge's fixed box */}
          <Stack mr="$3">
            <Token
              size="xs"
              borderRadius="$2"
              tokenImageUri={UNISWAP_PROTOCOL.logoURI}
              networkId={group.networkId}
              showNetworkIcon
            />
          </Stack>
          <SizableText size="$headingLg">{UNISWAP_PROTOCOL.name}</SizableText>
          <VerticalRule />
          <FiatText
            usd={group.valueUsd}
            size="$headingLg"
            color="$textSubdued"
          />
        </XStack>
      </YStack>
      <TableList<IPoolPositionView>
        data={group.positions}
        keyExtractor={(view) => view.position.id}
        columns={columns}
        withHeader={isDesktopLayout}
        tableLayout={isDesktopLayout}
        onPressRow={(view) =>
          PoolsNavigation.pushPosition(navigation, view.position.id)
        }
        expandable={expandable}
        headerProps={{ mt: '$3', minHeight: '$8' }}
        listItemProps={{
          ai: 'center',
          mt: isDesktopLayout ? '$2' : '$1',
        }}
      />
    </YStack>
  );
}

// The other cards' row action hit area (EarnHoldingSections)
const ROW_ACTION_HIT_SLOP = { top: 7, bottom: 7, left: 8, right: 12 };

type IPoolTokenRow = { token: IPoolAsset; amount: string };

/** Base first, as the pair reads; a token with nothing in it is left out */
function getPoolTokenRows(
  view: IPoolPositionView,
  [amount0, amount1]: [string, string],
): IPoolTokenRow[] {
  const { inverted } = getPoolPair(view.pool);
  const rows = [
    { token: view.pool.token0, amount: amount0 },
    { token: view.pool.token1, amount: amount1 },
  ];
  return (inverted ? rows.toReversed() : rows).filter((row) =>
    new BigNumber(row.amount).gt(0),
  );
}

/**
 * The other cards' panel (EarnHoldingSections): a title over token rows,
 * each the amount over its value. One action covers both tokens of a
 * position, so it sits centered beside the rows, not on one of them.
 */
function PoolHoldingPanel({
  title,
  rows,
  networkId,
  action,
}: {
  title: string;
  rows: IPoolTokenRow[];
  networkId: string;
  action: ReactNode;
}) {
  return (
    <YStack gap="$1" px="$3" py="$2" borderRadius="$3" bg="$bgSubdued">
      <SizableText size="$bodySmMedium" color="$textSubdued" py="$1">
        {title}
      </SizableText>
      <XStack ai="center" gap="$3">
        <YStack flex={1} minWidth={0}>
          {rows.map((row) => (
            <XStack
              key={row.token.id}
              ai="center"
              gap="$2"
              minHeight={36}
              py="$1"
            >
              <Token
                size="md"
                tokenImageUri={row.token.logoURI}
                showNetworkIcon
                networkId={networkId}
              />
              <YStack flexShrink={1} minWidth={0}>
                <NumberSizeableTextWrapper
                  hideValue
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: row.token.symbol }}
                  numberOfLines={1}
                >
                  {row.amount}
                </NumberSizeableTextWrapper>
                <FiatText
                  usd={new BigNumber(row.amount).times(row.token.priceUsd)}
                  size="$bodySm"
                  color="$textSubdued"
                />
              </YStack>
            </XStack>
          ))}
        </YStack>
        {action}
      </XStack>
    </YStack>
  );
}

/**
 * Phone portfolio: what a protocol row opens to. One card per position,
 * built like the other protocols' cards: type badge, name and value on the
 * line that opens the position, its range under it, then a panel per thing
 * the user holds, each with its action.
 */
export function PoolsPortfolioCards({
  group,
}: {
  group: IPoolsPortfolioGroup;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { collect, collectingId } = usePoolCollect();
  return (
    <>
      {group.positions.map((view) => {
        const { position, pool } = view;
        const inPool = getPoolTokenRows(view, [view.amount0, view.amount1]);
        const fees = canCollectPoolFees(view)
          ? getPoolTokenRows(view, [
              position.uncollectedFees0,
              position.uncollectedFees1,
            ])
          : [];
        const pairTitle = getPoolPairTitle(pool);
        return (
          <YStack
            key={position.id}
            gap="$3"
            testID={`earn-pools-portfolio-card-${position.id}`}
          >
            <YStack
              cursor="pointer"
              pressStyle={{ opacity: 0.6 }}
              onPress={() =>
                PoolsNavigation.pushPosition(navigation, position.id)
              }
            >
              <XStack ai="center" jc="space-between" gap="$2" minHeight={28}>
                <XStack ai="center" gap="$2" flex={1} minWidth={0}>
                  <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
                    <Badge.Text>{POOLS_COPY.lpBadge}</Badge.Text>
                  </Badge>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                    flex={1}
                  >
                    {`${pairTitle} ${getPoolSubtitle(view)}`}
                  </SizableText>
                </XStack>
                <XStack ai="center" gap="$1" flexShrink={0}>
                  <FiatText usd={view.valueUsd} size="$bodyLgMedium" />
                  <Icon
                    name="ChevronRightSmallOutline"
                    size="$5"
                    color="$iconSubdued"
                  />
                </XStack>
              </XStack>
              {/* What it earns beside the status, so it reads as working */}
              <XStack ai="center" jc="space-between" gap="$2">
                <PoolPositionStatus view={view} />
                {new BigNumber(view.fees24hUsd).gt(0) ? (
                  <XStack ai="center" gap="$1" flexShrink={1}>
                    <FiatText
                      usd={view.fees24hUsd}
                      size="$bodySmMedium"
                      color="$textSuccess"
                      showPlus
                    />
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                    >
                      {intl.formatMessage({
                        id: ETranslations.earn_24h_earnings,
                      })}
                    </SizableText>
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
            {inPool.length ? (
              <PoolHoldingPanel
                title={POOLS_COPY.inPool}
                rows={inPool}
                networkId={pool.networkId}
                action={
                  <Button
                    size="small"
                    variant="secondary"
                    hitSlop={ROW_ACTION_HIT_SLOP}
                    aria-label={`${POOLS_COPY.remove} ${pairTitle}`}
                    onPress={() =>
                      PoolsNavigation.pushRemove(navigation, position.id)
                    }
                    testID={`earn-pools-portfolio-remove-${position.id}`}
                  >
                    {POOLS_COPY.remove}
                  </Button>
                }
              />
            ) : null}
            {fees.length ? (
              <PoolHoldingPanel
                title={POOLS_COPY.unclaimedFees}
                rows={fees}
                networkId={pool.networkId}
                action={
                  <Button
                    size="small"
                    variant="secondary"
                    hitSlop={ROW_ACTION_HIT_SLOP}
                    aria-label={`${intl.formatMessage({ id: ETranslations.earn_claim })} ${pairTitle}`}
                    loading={collectingId === position.id}
                    onPress={() => void collect(view)}
                    testID={`earn-pools-portfolio-collect-${position.id}`}
                  >
                    {intl.formatMessage({ id: ETranslations.earn_claim })}
                  </Button>
                }
              />
            ) : null}
          </YStack>
        );
      })}
    </>
  );
}
