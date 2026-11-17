import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import {
  NetworkAvatar,
  NetworkAvatarBase,
} from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NetworksFilterItem } from '@onekeyhq/kit/src/components/NetworksFilterItem';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { CategoryFilterItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/CategoryFilterItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDustSweepNetwork } from '@onekeyhq/shared/types/swap/dustSweep';

import { useDustSweep } from '../DustSweepProvider';
import { DUST_SWEEP_THRESHOLDS } from '../utils/candidates';

import type { LayoutChangeEvent } from 'react-native';

const NETWORK_CHIP_HEIGHT = 36;
const NETWORK_CHIP_GAP = 8;
const CHIP_MEASURE_TEST_ID = 'dust-sweep-chip-measure';
const TOGGLE_MEASURE_TEST_ID = 'dust-sweep-toggle-measure';

function sameWidths(a: Record<string, number>, b: Record<string, number>) {
  const keys = Object.keys(b);
  return (
    keys.length === Object.keys(a).length &&
    keys.every((key) => a[key] === b[key])
  );
}

function readWidth(node: Element | null) {
  return node ? Math.ceil(node.getBoundingClientRect().width) : 0;
}

/**
 * The chips the collapsed one-row bar shows (OK-65481). Keeps list order,
 * always keeps the selected network, and leaves room for the "+N" toggle
 * whenever something is hidden. Undefined until every width is measured.
 * `pinnedOverflows` flags a selected chip too wide to share the row with the
 * toggle; the bar then shrinks that chip so the toggle stays reachable.
 */
export function resolveCollapsedNetworkIds({
  ids,
  widths,
  containerWidth,
  toggleWidth,
  selectedId,
  gap = NETWORK_CHIP_GAP,
}: {
  ids: string[];
  widths: Record<string, number>;
  containerWidth: number;
  toggleWidth: number;
  selectedId?: string;
  gap?: number;
}):
  | { visibleIds: string[]; hiddenCount: number; pinnedOverflows: boolean }
  | undefined {
  if (
    !containerWidth ||
    !toggleWidth ||
    ids.some((id) => widths[id] === undefined)
  ) {
    return undefined;
  }
  const fullWidth = ids.reduce(
    (sum, id, index) => sum + widths[id] + (index ? gap : 0),
    0,
  );
  if (fullWidth <= containerWidth) {
    return { visibleIds: ids, hiddenCount: 0, pinnedOverflows: false };
  }
  const budget = containerWidth - toggleWidth - gap;
  const pinnedId = selectedId && ids.includes(selectedId) ? selectedId : '';
  const visible = new Set(pinnedId ? [pinnedId] : []);
  let used = pinnedId ? widths[pinnedId] : 0;
  for (const id of ids.filter((item) => item !== pinnedId)) {
    const next = used + (visible.size ? gap : 0) + widths[id];
    // Stop at the first chip that does not fit so the row keeps list order.
    if (next > budget) break;
    visible.add(id);
    used = next;
  }
  const visibleIds = ids.filter((id) => visible.has(id));
  return {
    visibleIds,
    hiddenCount: ids.length - visibleIds.length,
    pinnedOverflows: Boolean(pinnedId) && widths[pinnedId] > budget,
  };
}

/** Rows a wrapping bar needs for these widths; 1 for an empty bar. */
export function countWrappedRows({
  widths,
  containerWidth,
  gap = NETWORK_CHIP_GAP,
}: {
  widths: number[];
  containerWidth: number;
  gap?: number;
}) {
  let rows = 1;
  let rowWidth = 0;
  widths.forEach((width) => {
    if (rowWidth && rowWidth + gap + width > containerWidth) {
      rows += 1;
      rowWidth = width;
    } else {
      rowWidth = rowWidth ? rowWidth + gap + width : width;
    }
  });
  return rows;
}

// Memoized: the bar also renders an off-screen measuring copy of every chip,
// and the Dust sweep context re-renders it on each token toggle.
const DustSweepNetworkChip = memo(function DustSweepNetworkChip({
  entry,
  selected,
  canSelect,
  onSelect,
  measureOnly = false,
  shrink = false,
  onMeasure,
}: {
  entry: IDustSweepNetwork;
  selected: boolean;
  canSelect: boolean;
  onSelect: (networkId: string) => void;
  measureOnly?: boolean;
  // Lets the chip give up width (clipping its amount) instead of pushing the
  // toggle off the collapsed row.
  shrink?: boolean;
  onMeasure?: (networkId: string, event: LayoutChangeEvent) => void;
}) {
  const networkId = entry.network.networkId;
  return (
    <Stack
      testID={
        measureOnly
          ? `${CHIP_MEASURE_TEST_ID}-${networkId}`
          : `dust-sweep-chip-layout-${networkId}`
      }
      height={NETWORK_CHIP_HEIGHT}
      flexShrink={shrink ? 1 : 0}
      minWidth={shrink ? 0 : undefined}
      overflow={shrink ? 'hidden' : undefined}
      onLayout={onMeasure ? (event) => onMeasure(networkId, event) : undefined}
    >
      <Button
        mx={0}
        my={0}
        testID={measureOnly ? undefined : `dust-sweep-network-${networkId}`}
        size="small"
        height={NETWORK_CHIP_HEIGHT}
        px="$2"
        borderRadius="$full"
        variant={selected ? 'secondary' : 'tertiary'}
        borderWidth={1}
        borderColor="$borderSubdued"
        accessibilityLabel={entry.network.name}
        accessibilityState={{ disabled: !canSelect }}
        focusable={canSelect && !measureOnly}
        onPress={
          canSelect && !measureOnly ? () => onSelect(networkId) : undefined
        }
      >
        <XStack gap="$1.5" alignItems="center">
          {/* Reuse the provided logo when chips mount instead of waiting
            for another network lookup. */}
          {entry.network.logoURI ? (
            <NetworkAvatarBase logoURI={entry.network.logoURI} size="$6" />
          ) : (
            <NetworkAvatar networkId={networkId} size="$6" />
          )}
          <Currency size="$bodyMdMedium" sourceCurrency="usd" formatter="value">
            {entry.balanceUsd}
          </Currency>
        </XStack>
      </Button>
    </Stack>
  );
});

const DustSweepNetworkToggle = memo(function DustSweepNetworkToggle({
  expanded,
  hiddenCount,
  onPress,
  onMeasure,
  measureOnly = false,
}: {
  expanded: boolean;
  hiddenCount: number;
  onPress?: () => void;
  onMeasure?: (event: LayoutChangeEvent) => void;
  measureOnly?: boolean;
}) {
  const intl = useIntl();
  return (
    <Stack
      testID={
        measureOnly
          ? `${TOGGLE_MEASURE_TEST_ID}-${expanded ? 'expanded' : 'collapsed'}`
          : undefined
      }
      height={NETWORK_CHIP_HEIGHT}
      flexShrink={0}
      onLayout={onMeasure}
    >
      <Button
        mx={0}
        my={0}
        testID={measureOnly ? undefined : 'dust-sweep-network-toggle'}
        size="small"
        height={NETWORK_CHIP_HEIGHT}
        px="$3"
        borderRadius="$full"
        variant="tertiary"
        borderWidth={1}
        borderColor="$borderSubdued"
        accessibilityLabel={intl.formatMessage({
          id: expanded
            ? ETranslations.global_collapse
            : ETranslations.global_expand,
        })}
        aria-expanded={expanded}
        focusable={!measureOnly}
        onPress={measureOnly ? undefined : onPress}
      >
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyMdMedium">
            {expanded
              ? intl.formatMessage({ id: ETranslations.global_collapse })
              : `+${hiddenCount}`}
          </SizableText>
          <Icon
            name={
              expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      </Button>
    </Stack>
  );
});

// Desktop bar: one row that expands downward instead of scrolling sideways,
// which mice without horizontal scrolling cannot reach (OK-65481).
function DustSweepDesktopNetworks({
  onExtraHeightChange,
}: {
  onExtraHeightChange?: (height: number) => void;
}) {
  const { networks, current, canSelectNetwork, selectNetwork, loadStatus } =
    useDustSweep();
  const [expanded, setExpanded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<Record<string, number>>({});
  const [toggleWidth, setToggleWidth] = useState(0);
  const [collapseToggleWidth, setCollapseToggleWidth] = useState(0);
  const handleChipMeasure = useCallback(
    (networkId: string, event: LayoutChangeEvent) => {
      const width = Math.ceil(event.nativeEvent.layout.width);
      setChipWidths((previous) =>
        previous[networkId] === width
          ? previous
          : { ...previous, [networkId]: width },
      );
    },
    [],
  );
  const handleToggleMeasure = useCallback((event: LayoutChangeEvent) => {
    setToggleWidth(Math.ceil(event.nativeEvent.layout.width));
  }, []);
  const handleCollapseToggleMeasure = useCallback(
    (event: LayoutChangeEvent) => {
      setCollapseToggleWidth(Math.ceil(event.nativeEvent.layout.width));
    },
    [],
  );
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);
  const ids = networks.map((entry) => entry.network.networkId);
  // On web, Tamagui's onLayout re-measures on a throttled poll that lagged or
  // missed resizes here, so the bar's width and each measured chip (an amount
  // can grow) also follow ResizeObserver. onLayout still gives the first
  // measure, and is what tests drive.
  const networkIdsKey = ids.join(',');
  const [barNode, setBarNode] = useState<HTMLElement | null>(null);
  const [measureNode, setMeasureNode] = useState<HTMLElement | null>(null);
  const registerBar = useCallback((node: unknown) => {
    setBarNode(node instanceof HTMLElement ? node : null);
  }, []);
  const registerMeasure = useCallback((node: unknown) => {
    setMeasureNode(node instanceof HTMLElement ? node : null);
  }, []);
  useEffect(() => {
    if (!barNode || !measureNode || typeof ResizeObserver === 'undefined') {
      return;
    }
    const sync = () => {
      setContainerWidth(Math.floor(barNode.getBoundingClientRect().width));
      const widths: Record<string, number> = {};
      measureNode
        .querySelectorAll(`[data-testid^="${CHIP_MEASURE_TEST_ID}-"]`)
        .forEach((node) => {
          const id = node
            .getAttribute('data-testid')
            ?.slice(CHIP_MEASURE_TEST_ID.length + 1);
          if (id) widths[id] = readWidth(node);
        });
      setChipWidths((previous) =>
        sameWidths(previous, widths) ? previous : widths,
      );
      setToggleWidth(
        readWidth(
          measureNode.querySelector(
            `[data-testid="${TOGGLE_MEASURE_TEST_ID}-collapsed"]`,
          ),
        ),
      );
      setCollapseToggleWidth(
        readWidth(
          measureNode.querySelector(
            `[data-testid="${TOGGLE_MEASURE_TEST_ID}-expanded"]`,
          ),
        ),
      );
    };
    const observer = new ResizeObserver(sync);
    observer.observe(barNode);
    // Each measured chip on its own: the measuring row is capped at the bar's
    // width, so one chip growing need not change the row's size.
    measureNode
      .querySelectorAll(
        `[data-testid^="${CHIP_MEASURE_TEST_ID}-"], [data-testid^="${TOGGLE_MEASURE_TEST_ID}-"]`,
      )
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [barNode, measureNode, networkIdsKey]);
  const collapsed = resolveCollapsedNetworkIds({
    ids,
    widths: chipWidths,
    containerWidth,
    toggleWidth,
    selectedId: current?.network.networkId,
  });
  const hiddenCount = collapsed?.hiddenCount ?? 0;
  const showsAll = expanded || !collapsed;
  const visibleIds = new Set(showsAll ? ids : collapsed.visibleIds);
  const showToggle = hiddenCount > 0 || (expanded && Boolean(collapsed));
  const shrinkPinned = !expanded && Boolean(collapsed?.pinnedOverflows);
  // The height the expanded rows add, from the measured widths, so the page
  // can give it back from the cards in the same pass.
  const rows =
    expanded && collapsed
      ? countWrappedRows({
          widths: [...ids.map((id) => chipWidths[id]), collapseToggleWidth],
          containerWidth,
        })
      : 1;
  const extraHeight = (rows - 1) * (NETWORK_CHIP_HEIGHT + NETWORK_CHIP_GAP);
  useEffect(() => {
    onExtraHeightChange?.(extraHeight);
  }, [extraHeight, onExtraHeightChange]);
  return (
    <Stack
      ref={registerBar}
      testID="dust-sweep-network-scroll"
      flexGrow={0}
      minHeight={NETWORK_CHIP_HEIGHT}
      // Until widths are known the row is clipped to one line, so the first
      // paint never pushes the cards down and then jumps back.
      maxHeight={expanded ? undefined : NETWORK_CHIP_HEIGHT}
      overflow={expanded ? undefined : 'hidden'}
      onLayout={(event) =>
        setContainerWidth(Math.floor(event.nativeEvent.layout.width))
      }
      // While sweeping the chips keep their look but can't be changed.
      cursor={canSelectNetwork ? undefined : 'not-allowed'}
    >
      <XStack
        flexWrap={shrinkPinned ? 'nowrap' : 'wrap'}
        alignItems="center"
        gap="$2"
        pointerEvents={canSelectNetwork ? 'auto' : 'none'}
      >
        {loadStatus === 'loading' && !networks.length
          ? [0, 1, 2, 3].map((key) => (
              <Skeleton
                key={key}
                width={96}
                height={NETWORK_CHIP_HEIGHT}
                radius="round"
              />
            ))
          : null}
        {networks
          .filter((entry) => visibleIds.has(entry.network.networkId))
          .map((entry) => (
            <DustSweepNetworkChip
              key={entry.network.networkId}
              entry={entry}
              selected={entry === current}
              canSelect={canSelectNetwork}
              shrink={shrinkPinned && entry === current}
              // Stays expanded after a pick; only the toggle folds it back.
              onSelect={selectNetwork}
            />
          ))}
        {showToggle ? (
          <DustSweepNetworkToggle
            expanded={expanded}
            hiddenCount={hiddenCount}
            onPress={toggleExpanded}
          />
        ) : null}
      </XStack>
      {/* Off-screen copy that measures every chip at its natural width. */}
      <XStack
        ref={registerMeasure}
        testID="dust-sweep-network-measure"
        position="absolute"
        top={0}
        left={0}
        opacity={0}
        pointerEvents="none"
        aria-hidden
        gap="$2"
      >
        {networks.map((entry) => (
          <DustSweepNetworkChip
            key={entry.network.networkId}
            entry={entry}
            selected={entry === current}
            canSelect={false}
            onSelect={selectNetwork}
            measureOnly
            onMeasure={handleChipMeasure}
          />
        ))}
        <DustSweepNetworkToggle
          expanded={false}
          hiddenCount={networks.length}
          measureOnly
          onMeasure={handleToggleMeasure}
        />
        <DustSweepNetworkToggle
          expanded
          hiddenCount={0}
          measureOnly
          onMeasure={handleCollapseToggleMeasure}
        />
      </XStack>
    </Stack>
  );
}

export function DustSweepNetworks({
  desktop = false,
  onExtraHeightChange,
}: {
  desktop?: boolean;
  // Desktop only: the height the expanded rows add below the first one.
  onExtraHeightChange?: (height: number) => void;
}) {
  const { networks, current, canSelectNetwork, selectNetwork } = useDustSweep();
  const intl = useIntl();
  const openChainSelector = useConfigurableChainSelector();
  const title = intl.formatMessage({ id: ETranslations.global_select_network });
  const networkSelectionDisabled = !canSelectNetwork || !networks.length;
  if (desktop)
    return (
      <DustSweepDesktopNetworks onExtraHeightChange={onExtraHeightChange} />
    );
  return (
    <NetworksFilterItem
      testID="dust-sweep-network-menu"
      role="button"
      accessibilityLabel={current?.network.name ?? title}
      accessibilityState={{ disabled: networkSelectionDisabled }}
      networkImageUri={current?.network.logoURI}
      networkImageSize="$6"
      keepNetworkImageSize
      // Icon only once a network is selected; the name stays in the a11y label.
      networkName={current ? undefined : title}
      networkNameProps={{ size: '$bodyMd', color: '$text', flexShrink: 1 }}
      iconAfter="ChevronDownSmallOutline"
      height={36}
      px="$2"
      py={0}
      gap="$1"
      alignItems="center"
      borderRadius="$full"
      borderColor="$transparent"
      bg="$bgStrong"
      disabled={!networks.length}
      focusable={!networkSelectionDisabled}
      cursor={networkSelectionDisabled ? 'not-allowed' : 'pointer'}
      onPress={
        networkSelectionDisabled
          ? undefined
          : () =>
              openChainSelector({
                title,
                defaultNetworkId: current?.network.networkId,
                networkIds: networks.map((entry) => entry.network.networkId),
                // Same networks and balances as the desktop chips, listed like
                // the wallet's network selector: valued ones first by value.
                networkValues: Object.fromEntries(
                  networks.map((entry) => [
                    entry.network.networkId,
                    entry.balanceUsd,
                  ]),
                ),
                networkValueCurrency: 'usd',
                groupByNetworkValue: true,
                recentNetworksEnabled: false,
                highlightSelected: true,
                excludeAllNetworkItem: true,
                onSelect: (network) => selectNetwork(network.id),
              })
      }
    />
  );
}

export function DustSweepFilters({ desktop }: { desktop: boolean }) {
  const { selecting, threshold, selectThreshold } = useDustSweep();
  return (
    <XStack
      height={56}
      px="$5"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack
        gap="$1"
        cursor={selecting ? undefined : 'not-allowed'}
        pointerEvents={selecting ? 'auto' : 'none'}
      >
        {DUST_SWEEP_THRESHOLDS.map((amount) => (
          <CategoryFilterItem
            testID={`dust-sweep-threshold-${amount}`}
            key={amount}
            name={`<$${amount}`}
            isSelected={threshold === amount}
            height={36}
            px="$3"
            borderRadius="$full"
            role="button"
            {...(platformEnv.isNative
              ? { accessibilityState: { selected: threshold === amount } }
              : { 'aria-pressed': threshold === amount })}
            aria-disabled={!selecting}
            focusable={selecting}
            onPress={() => selectThreshold(amount)}
          />
        ))}
      </XStack>
      {desktop ? null : <DustSweepNetworks />}
    </XStack>
  );
}
