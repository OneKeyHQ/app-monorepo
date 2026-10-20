import { useCallback } from 'react';

import {
  Alert,
  Button,
  IconButton,
  SizableText,
  Toast,
  XStack,
  YStack,
  useShare,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import { EPoolListingStatus } from '@onekeyhq/shared/types/pools';
import type { IPoolDetail, IPoolListItem } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatCompactUsd, formatPercent } from '../poolsFormat';
import { PoolsNavigation, buildPoolShareLink } from '../poolsNavigation';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolFavorites } from '../usePoolFavorites';
import { usePoolPositionForm } from '../usePoolPositionForm';

import { PoolOverviewChart } from './PoolOverviewChart';
import { PoolPositionForm, PoolPositionReviewButton } from './PoolPositionForm';
import { PoolRangeEditor } from './PoolRangeEditor';
import { PoolsCard } from './PoolsCard';
import { PoolTags } from './PoolTags';
import { PoolTopPositions } from './PoolTopPositions';
import { PoolUnfinishedTasks } from './PoolUnfinishedTasks';

import type { IPoolPositionForm } from '../usePoolPositionForm';

/**
 * Wide layouts set the range on the price chart. The web chart takes drags;
 * the native WebView chart does not, so wide native screens keep the form's
 * own range card.
 */
export const CAN_SET_RANGE_ON_CHART = !platformEnv.isNative;

/**
 * The pool page keeps the create card in view while the pool's data scrolls
 * past it (web; native has no sticky positioning).
 */
export const POOL_CREATE_COLUMN_STICKY = platformEnv.isNative
  ? {}
  : ({ position: 'sticky', top: '$4' } as const);

// The web app's top bar covers the first 64px of the window
const REVEAL_MIN_TOP = 64;

/**
 * DOM ids a copied range scrolls back to: an opened row's columns, whose
 * card cannot stay in view inside the Earn home's tab view.
 */
export function getPoolRevealId(
  part: 'columns',
  surface: 'row' | 'page',
  poolId: string,
) {
  return `earn-pool-${part}-${surface}-${poolId}`;
}

/** Market's star: filled while the pool is a favorite */
export function PoolStarButton({
  poolId,
  size = 'small',
  testID,
}: {
  poolId: string;
  size?: IIconButtonProps['size'];
  testID?: string;
}) {
  const { favoriteIds, toggleFavorite } = usePoolFavorites();
  const checked = favoriteIds.has(poolId);
  return (
    <IconButton
      testID={testID ?? `earn-pool-star-${poolId}`}
      size={size}
      variant="tertiary"
      icon={checked ? 'StarSolid' : 'StarOutline'}
      iconProps={{ color: checked ? '$iconActive' : '$iconSubdued' }}
      title={checked ? POOLS_COPY.removeFavorite : POOLS_COPY.addFavorite}
      onPress={(event) => {
        // In a row, the star must not open the row as well
        event?.stopPropagation?.();
        void toggleFavorite(poolId);
      }}
    />
  );
}

export function usePoolShare(pool: IPoolListItem) {
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  return useCallback(
    () =>
      void shareText(
        buildPoolShareLink(pool, { isDevMode: devSettings.enabled }),
      ),
    [devSettings.enabled, pool, shareText],
  );
}

/** The pair's other pools, one row each, each opening its page */
export function PoolSamePairList({ pools }: { pools: IPoolListItem[] }) {
  const navigation = useAppNavigation();
  return (
    <YStack>
      {pools.map((pool, index) => (
        <XStack
          key={pool.id}
          testID={`earn-pool-same-pair-${pool.id}`}
          role="button"
          ai="center"
          gap="$3"
          py="$2.5"
          borderTopWidth={index ? 1 : 0}
          borderTopColor="$borderSubdued"
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => PoolsNavigation.pushPoolDetails(navigation, pool.id)}
        >
          <PoolTags pool={pool} flex={1} />
          <YStack ai="flex-end" gap="$0.5">
            <SizableText size="$bodyMdMedium">
              {`${formatPercent(pool.windows['1D'].apr)} ${POOLS_COPY.apr}`}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`${formatCompactUsd(pool.tvlUsd)} ${POOLS_COPY.tvl}`}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

/** Other fee tiers and versions of the pair, to compare before opening */
export function PoolSamePairCard({ pools }: { pools: IPoolListItem[] }) {
  if (!pools.length) {
    return null;
  }
  return (
    <PoolsCard title={POOLS_COPY.samePair} testID="earn-pool-same-pair">
      <PoolSamePairList pools={pools} />
    </PoolsCard>
  );
}

/**
 * What an opened pool and its page share: the pool's data, the form, and
 * what links them (the form's range on the chart, a copied range in the
 * form). The pool from the list shows at once; the rest fills in.
 */
export function usePoolOverview({
  pool: listPool,
  onTaskCreated,
}: {
  pool: IPoolListItem;
  onTaskCreated: (taskId: string) => void;
}) {
  const { result: detail } = usePoolsQuery(PoolsQueries.detail(listPool.id));
  const { result: wallet } = usePoolsQuery(
    PoolsQueries.wallet(listPool.networkId),
    { refreshOnFocus: true },
  );
  const pool = detail?.pool ?? listPool;
  const form = usePoolPositionForm({
    pool,
    wallet,
    priceHistory: detail?.priceHistory,
    onTaskCreated,
  });
  const canCreate = pool.listingStatus === EPoolListingStatus.Listed;
  return { pool, detail, wallet, form, canCreate };
}

/**
 * The pool's price chart. With the create form on the same screen it draws
 * the form's range, and wide web screens set the range there: drag the band,
 * or use the controls under it.
 */
export function PoolChartSection({
  pool,
  detail,
  form,
  layout,
  chartHeight,
  rangeOnChart = false,
}: {
  pool: IPoolListItem;
  detail: IPoolDetail | undefined;
  /** None when the form opens elsewhere (a phone's create modal) */
  form?: IPoolPositionForm;
  layout: 'table' | 'list';
  chartHeight: number;
  rangeOnChart?: boolean;
}) {
  const editForm = rangeOnChart && form?.isRange ? form : undefined;
  return (
    <PoolOverviewChart
      pool={pool}
      ticks={detail?.ticks}
      range={form?.isRange ? form.range : undefined}
      onRangeChange={editForm?.setRange}
      flipped={form?.flipped}
      onFlippedChange={form?.setFlipped}
      renderRangeControls={
        editForm
          ? (flipped) => (
              <PoolRangeEditor
                pool={editForm.pool}
                priceHistory={detail?.priceHistory ?? []}
                estimate={editForm.estimate}
                range={editForm.range}
                presets={editForm.presets}
                presetId={editForm.presetId}
                onChange={editForm.setRange}
                underPriceChart
                flipped={flipped}
              />
            )
          : undefined
      }
      height={chartHeight}
      stripWidth={layout === 'table' ? 72 : 52}
    />
  );
}

/**
 * An opened row's info under its chart: top positions to copy a range from,
 * then the pair's other pools.
 */
export function PoolInfoSection({
  pool,
  detail,
  layout,
  onCopyRange,
}: {
  pool: IPoolListItem;
  detail: IPoolDetail | undefined;
  layout: 'table' | 'list';
  onCopyRange: (range: IPoolTickRange) => void;
}) {
  return (
    <YStack gap="$4">
      {pool.capabilities.priceRange ? (
        <PoolTopPositions
          pool={pool}
          layout={layout}
          onCopyRange={onCopyRange}
        />
      ) : null}
      <PoolSamePairCard pools={detail?.pairPools ?? []} />
    </YStack>
  );
}

/** An opened row's data: the chart, then the info under it */
export function PoolDataSection({
  pool,
  detail,
  form,
  layout,
  chartHeight,
  rangeOnChart = false,
  onCopyRange,
}: {
  pool: IPoolListItem;
  detail: IPoolDetail | undefined;
  form: IPoolPositionForm;
  layout: 'table' | 'list';
  chartHeight: number;
  rangeOnChart?: boolean;
  onCopyRange: (range: IPoolTickRange) => void;
}) {
  return (
    <YStack gap="$4">
      <PoolChartSection
        pool={pool}
        detail={detail}
        form={form}
        layout={layout}
        chartHeight={chartHeight}
        rangeOnChart={rangeOnChart}
      />
      <PoolInfoSection
        pool={pool}
        detail={detail}
        layout={layout}
        onCopyRange={onCopyRange}
      />
    </YStack>
  );
}

export function PoolCreateSection({
  form,
  detail,
  canCreate,
  showButton,
  rangeOnChart = false,
}: {
  form: IPoolPositionForm;
  detail: IPoolDetail | undefined;
  canCreate: boolean;
  /** False when the page footer holds the button */
  showButton: boolean;
  /** The chart beside the form sets the range */
  rangeOnChart?: boolean;
}) {
  if (!canCreate) {
    return <Alert type="warning" title={POOLS_COPY.unlistedNotice} />;
  }
  return (
    <YStack gap="$4">
      <PoolUnfinishedTasks poolId={form.pool.id} />
      <PoolPositionForm
        form={form}
        ticks={detail?.ticks}
        priceHistory={detail?.priceHistory}
        rangeOnChart={rangeOnChart}
        button={showButton ? <PoolPositionReviewButton form={form} /> : null}
      />
    </YStack>
  );
}

/**
 * Brings a section into view on the web after the next paint, unless its top
 * is already on screen. Native lists keep their own scroll position.
 */
export function revealPoolSection(id: string) {
  if (platformEnv.isNative) {
    return;
  }
  requestAnimationFrame(() => {
    const node = globalThis.document?.getElementById(id);
    if (!node) {
      return;
    }
    const { top } = node.getBoundingClientRect();
    // Below the app's top bar and in the upper part of the window
    if (top >= REVEAL_MIN_TOP && top < globalThis.innerHeight * 0.6) {
      return;
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/**
 * Sets a copied range in the form and says so. An opened row then scrolls
 * back up to its chart and card. The pool page stays put on wide screens,
 * as its create card stays in view beside the list; phones open the create
 * modal with the range.
 */
export function useCopyRange(
  form: IPoolPositionForm,
  {
    onCopied,
    revealId,
  }: {
    onCopied?: (range: IPoolTickRange) => void;
    /** Where to scroll back to, if anywhere */
    revealId?: string;
  } = {},
) {
  const { setRange } = form;
  return useCallback(
    (range: IPoolTickRange) => {
      setRange(range);
      Toast.success({ title: POOLS_COPY.rangeCopied });
      onCopied?.(range);
      if (revealId) {
        revealPoolSection(revealId);
      }
    },
    [onCopied, revealId, setRange],
  );
}

/**
 * An opened row in the wide pools table: the pool's data beside the form,
 * so a typed amount or a copied range stays in view. Phones open the pool
 * page instead.
 */
export function PoolExpandedPanel({ pool: listPool }: { pool: IPoolListItem }) {
  const navigation = useAppNavigation();
  const { pool, detail, form, canCreate } = usePoolOverview({
    pool: listPool,
    onTaskCreated: (taskId) => PoolsNavigation.pushTask(navigation, taskId),
  });
  const columnsId = getPoolRevealId('columns', 'row', pool.id);
  const copyRange = useCopyRange(form, { revealId: columnsId });
  const share = usePoolShare(pool);

  return (
    <YStack testID={`earn-pool-panel-${pool.id}`} gap="$4">
      <XStack id={columnsId} gap="$5" ai="flex-start">
        <YStack flex={1} minWidth={0}>
          <PoolDataSection
            pool={pool}
            detail={detail}
            form={form}
            layout="table"
            chartHeight={260}
            rangeOnChart={CAN_SET_RANGE_ON_CHART && canCreate}
            onCopyRange={copyRange}
          />
        </YStack>
        <YStack
          testID={`earn-pool-create-column-${pool.id}`}
          width={400}
          flexShrink={0}
        >
          <PoolCreateSection
            form={form}
            detail={detail}
            canCreate={canCreate}
            showButton
            rangeOnChart={CAN_SET_RANGE_ON_CHART}
          />
        </YStack>
      </XStack>
      <XStack gap="$2" ai="center" flexWrap="wrap">
        <Button
          testID={`earn-pool-open-page-${pool.id}`}
          size="small"
          variant="secondary"
          icon="ArrowTopRightOutline"
          onPress={() => PoolsNavigation.pushPoolDetails(navigation, pool.id)}
        >
          {POOLS_COPY.openPoolPage}
        </Button>
        <Button
          testID={`earn-pool-share-${pool.id}`}
          size="small"
          variant="tertiary"
          icon="ShareOutline"
          onPress={share}
        >
          {POOLS_COPY.share}
        </Button>
      </XStack>
    </YStack>
  );
}
