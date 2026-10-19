import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Alert,
  Button,
  IconButton,
  SegmentControl,
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
import { PoolStatsStrip } from './PoolStats';
import { PoolTags } from './PoolTags';
import { PoolTopPositions } from './PoolTopPositions';
import { PoolUnfinishedTasks } from './PoolUnfinishedTasks';

import type { IPoolPositionForm } from '../usePoolPositionForm';

export type IPoolOverviewTab = 'data' | 'create';

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
 * DOM ids a copied range scrolls back to: the tabs above the form on phones,
 * and an opened row's columns, whose card cannot stay in view inside the
 * Earn home's tab view.
 */
export function getPoolRevealId(
  part: 'tabs' | 'columns',
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

/** Other fee tiers and versions of the pair, to compare before opening */
export function PoolSamePairCard({ pools }: { pools: IPoolListItem[] }) {
  const navigation = useAppNavigation();
  if (!pools.length) {
    return null;
  }
  return (
    <PoolsCard title={POOLS_COPY.samePair} testID="earn-pool-same-pair">
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
  const form = usePoolPositionForm({ pool, wallet, onTaskCreated });
  const canCreate = pool.listingStatus === EPoolListingStatus.Listed;
  return { pool, detail, wallet, form, canCreate };
}

export function PoolDataSection({
  pool,
  detail,
  form,
  layout,
  chartHeight,
  rangeOnChart = false,
  onCopyRange,
  afterChart,
  children,
}: {
  pool: IPoolListItem;
  detail: IPoolDetail | undefined;
  form: IPoolPositionForm;
  layout: 'table' | 'list';
  chartHeight: number;
  /** The range is set on the chart: drag its band, or the controls under it */
  rangeOnChart?: boolean;
  onCopyRange: (range: IPoolTickRange) => void;
  /** The page's own cards: after the chart, and after top positions */
  afterChart?: ReactNode;
  children?: ReactNode;
}) {
  const editRange = rangeOnChart && form.isRange;
  return (
    <YStack gap="$4">
      <PoolOverviewChart
        pool={pool}
        ticks={detail?.ticks}
        range={form.isRange ? form.range : undefined}
        onRangeChange={editRange ? form.setRange : undefined}
        renderRangeControls={
          editRange
            ? (flipped) => (
                <PoolRangeEditor
                  pool={form.pool}
                  priceHistory={detail?.priceHistory ?? []}
                  estimate={form.estimate}
                  range={form.range}
                  presetId={form.presetId}
                  onChange={form.setRange}
                  underPriceChart
                  flipped={flipped}
                />
              )
            : undefined
        }
        height={chartHeight}
        stripWidth={layout === 'table' ? 72 : 52}
      />
      {afterChart}
      {pool.capabilities.priceRange ? (
        <PoolTopPositions
          pool={pool}
          layout={layout}
          onCopyRange={onCopyRange}
        />
      ) : null}
      {children}
      <PoolSamePairCard pools={detail?.pairPools ?? []} />
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
  const button = showButton ? <PoolPositionReviewButton form={form} /> : null;
  return (
    <YStack gap="$4">
      <PoolUnfinishedTasks poolId={form.pool.id} />
      <PoolPositionForm
        form={form}
        ticks={detail?.ticks}
        priceHistory={detail?.priceHistory}
        rangeOnChart={rangeOnChart}
        button={rangeOnChart ? button : undefined}
      />
      {rangeOnChart ? null : button}
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
 * Sets a copied range in the form and says so. Phones then switch to the
 * form's tab and scroll back to it. The pool page stays put, as its create
 * card stays in view beside the list and shows the range; an opened row
 * scrolls back up to its chart and card.
 */
export function useCopyRange(
  form: IPoolPositionForm,
  {
    onCopied,
    revealId,
  }: {
    onCopied?: () => void;
    /** Where to scroll back to, if anywhere */
    revealId?: string;
  } = {},
) {
  const { setRange } = form;
  return useCallback(
    (range: IPoolTickRange) => {
      setRange(range);
      Toast.success({ title: POOLS_COPY.rangeCopied });
      onCopied?.();
      if (revealId) {
        revealPoolSection(revealId);
      }
    },
    [onCopied, revealId, setRange],
  );
}

export function PoolOverviewTabs({
  value,
  onChange,
}: {
  value: IPoolOverviewTab;
  onChange: (value: IPoolOverviewTab) => void;
}) {
  return (
    <SegmentControl
      fullWidth
      value={value}
      options={[
        {
          label: POOLS_COPY.poolData,
          value: 'data',
          testID: 'earn-pool-tab-data',
        },
        {
          label: POOLS_COPY.createPosition,
          value: 'create',
          testID: 'earn-pool-tab-create',
        },
      ]}
      onChange={(next) => onChange(next as IPoolOverviewTab)}
    />
  );
}

/**
 * An opened row in the pools list. Wide screens put the pool's data beside
 * the form; phones switch between them. Both stay mounted, so a typed
 * amount or a copied range survives the switch.
 */
export function PoolExpandedPanel({
  pool: listPool,
  wide,
}: {
  pool: IPoolListItem;
  wide: boolean;
}) {
  const navigation = useAppNavigation();
  const [tab, setTab] = useState<IPoolOverviewTab>('data');
  const { pool, detail, form, canCreate } = usePoolOverview({
    pool: listPool,
    onTaskCreated: (taskId) => PoolsNavigation.pushTask(navigation, taskId),
  });
  const showCreate = useCallback(() => setTab('create'), []);
  const rangeOnChart = wide && CAN_SET_RANGE_ON_CHART;
  const tabsId = getPoolRevealId('tabs', 'row', pool.id);
  const columnsId = getPoolRevealId('columns', 'row', pool.id);
  const copyRange = useCopyRange(
    form,
    wide ? { revealId: columnsId } : { onCopied: showCreate, revealId: tabsId },
  );
  const share = usePoolShare(pool);

  const links = (
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
  );

  const data = (
    <PoolDataSection
      pool={pool}
      detail={detail}
      form={form}
      layout={wide ? 'table' : 'list'}
      chartHeight={wide ? 260 : 200}
      rangeOnChart={rangeOnChart && canCreate}
      onCopyRange={copyRange}
    />
  );
  const create = (
    <PoolCreateSection
      form={form}
      detail={detail}
      canCreate={canCreate}
      showButton
      rangeOnChart={rangeOnChart}
    />
  );

  if (wide) {
    return (
      <YStack testID={`earn-pool-panel-${pool.id}`} gap="$4">
        <XStack id={columnsId} gap="$5" ai="flex-start">
          <YStack flex={1} minWidth={0}>
            {data}
          </YStack>
          <YStack
            testID={`earn-pool-create-column-${pool.id}`}
            width={400}
            flexShrink={0}
          >
            {create}
          </YStack>
        </XStack>
        {links}
      </YStack>
    );
  }

  return (
    <YStack testID={`earn-pool-panel-${pool.id}`} gap="$4">
      {canCreate ? (
        <YStack id={tabsId}>
          <PoolOverviewTabs value={tab} onChange={setTab} />
        </YStack>
      ) : null}
      <YStack gap="$4" display={tab === 'data' ? 'flex' : 'none'}>
        <PoolStatsStrip pool={pool} compact />
        {data}
      </YStack>
      {canCreate ? (
        <YStack display={tab === 'create' ? 'flex' : 'none'}>{create}</YStack>
      ) : null}
      {links}
    </YStack>
  );
}
