import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartPreset,
  ITradingViewNativeMultiChartSizes,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_HEIGHT,
  TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_WIDTH,
  fillTradingViewNativeMultiChartPanels,
  getTradingViewNativeMultiChartDividers,
  getTradingViewNativeMultiChartPanelIds,
  getTradingViewNativeMultiChartRects,
  getTradingViewNativeMultiChartSizes,
  hasUnfilledTradingViewNativeMultiChartPanel,
  normalizeTradingViewNativeMultiChartLayout,
  resizeTradingViewNativeMultiChartTracks,
  setTradingViewNativeMultiChartPanelSource,
  setTradingViewNativeMultiChartSizes,
  updateTradingViewNativeMultiChartPanel,
} from './multiChartLayout';
import { TradingViewNativeMultiChartDivider } from './TradingViewNativeMultiChartDivider';
import { TradingViewNativeMultiChartLayoutSelect } from './TradingViewNativeMultiChartLayoutSelect';
import { TradingViewNativeMultiChartPanelContext } from './TradingViewNativeMultiChartPanelContext';

import type { ITradingViewNativeMultiChartAxis } from './multiChartLayout';
import type {
  ITradingViewNativeMultiChartPanel,
  ITradingViewNativeMultiChartProps,
} from './TradingViewNativeMultiChart.types';
import type { ITradingViewNativeMultiChartPanelScope } from './TradingViewNativeMultiChartPanelContext';
import type { LayoutChangeEvent } from 'react-native';

type IOnLayoutChange = ITradingViewNativeMultiChartProps['onLayoutChange'];

function ignoreSourceChange() {}

// Gives the chart inside an extra panel its own indicator settings, stored in
// the layout snapshot beside the panel's token.
function PanelScope({
  children,
  indicatorSettings,
  onLayoutChange,
  panelId,
}: {
  children: ReactNode;
  indicatorSettings: ITradingViewNativeIndicatorSettings;
  onLayoutChange: IOnLayoutChange;
  panelId: string;
}) {
  const fallback = useRef(indicatorSettings);
  fallback.current = indicatorSettings;
  const setIndicatorSettings = useCallback(
    (update: SetStateAction<ITradingViewNativeIndicatorSettings>) => {
      onLayoutChange((current) => {
        const layout = normalizeTradingViewNativeMultiChartLayout(current);
        const previous =
          layout.panels[panelId]?.indicatorSettings ?? fallback.current;
        return updateTradingViewNativeMultiChartPanel(layout, panelId, {
          indicatorSettings:
            typeof update === 'function' ? update(previous) : update,
        });
      });
    },
    [onLayoutChange, panelId],
  );
  const scope = useMemo<ITradingViewNativeMultiChartPanelScope>(
    () => ({
      panelId,
      indicatorSettingsState: [indicatorSettings, setIndicatorSettings],
    }),
    [indicatorSettings, panelId, setIndicatorSettings],
  );
  return (
    <TradingViewNativeMultiChartPanelContext.Provider value={scope}>
      {children}
    </TradingViewNativeMultiChartPanelContext.Provider>
  );
}

const Panel = memo(
  ({
    id,
    index,
    indicatorSettings,
    isSplit,
    layoutControl,
    onLayoutChange,
    renderPanel,
    source,
  }: {
    id: string;
    index: number;
    indicatorSettings: ITradingViewNativeIndicatorSettings;
    isSplit: boolean;
    layoutControl: ReactNode;
    onLayoutChange: IOnLayoutChange;
    renderPanel: ITradingViewNativeMultiChartProps['renderPanel'];
    source: ITradingViewNativeSource;
  }) => {
    const isMain = index === 0;
    const setSource = useCallback<
      ITradingViewNativeMultiChartPanel['setSource']
    >(
      (nextSource, options) => {
        onLayoutChange((current) => {
          const layout = normalizeTradingViewNativeMultiChartLayout(current);
          const next = setTradingViewNativeMultiChartPanelSource(
            layout,
            id,
            nextSource,
            options?.replacing,
          );
          // Nothing to save when the panel has moved on.
          return next === layout ? current : next;
        });
      },
      [id, onLayoutChange],
    );
    const panel = useMemo<ITradingViewNativeMultiChartPanel>(
      () => ({
        id,
        index,
        isMain,
        isSplit,
        source,
        layoutControl: isMain ? layoutControl : null,
        setSource: isMain ? ignoreSourceChange : setSource,
      }),
      [id, index, isMain, isSplit, layoutControl, setSource, source],
    );
    const content = renderPanel(panel);
    // The first panel stays outside the scope: it keeps the host's own
    // interval, indicators and drawings whether or not the view is split.
    return isMain ? (
      content
    ) : (
      <PanelScope
        panelId={id}
        indicatorSettings={indicatorSettings}
        onLayoutChange={onLayoutChange}
      >
        {content}
      </PanelScope>
    );
  },
);

Panel.displayName = 'TradingViewNativeMultiChartPanel';

interface IResizeDraft {
  preset: ITradingViewNativeMultiChartPreset;
  sizes: ITradingViewNativeMultiChartSizes;
  // Set on release: the saved layout the draft is waiting to be replaced by.
  committedOver?: ITradingViewNativeMultiChartProps['layout'];
}

export function TradingViewNativeMultiChart({
  defaultIndicatorSettings,
  getDefaultPanelSource,
  layout: storedLayout,
  mainSource,
  onLayoutChange,
  renderPanel,
  testID = 'trading-view-multi-chart',
}: ITradingViewNativeMultiChartProps) {
  const intl = useIntl();
  const layout = useMemo(
    () => normalizeTradingViewNativeMultiChartLayout(storedLayout),
    [storedLayout],
  );
  const { preset } = layout;
  const panelIds = useMemo(
    () => getTradingViewNativeMultiChartPanelIds(preset),
    [preset],
  );
  const isSplit = panelIds.length > 1;

  const defaults = useRef({
    mainSource,
    getDefaultPanelSource,
    indicatorSettings: defaultIndicatorSettings,
  });
  defaults.current = {
    mainSource,
    getDefaultPanelSource,
    indicatorSettings: defaultIndicatorSettings,
  };
  // Covers a layout saved without a panel's token or indicator settings, e.g.
  // by another build. The layout picker fills new panels itself.
  const hasIncompletePanel =
    hasUnfilledTradingViewNativeMultiChartPanel(layout);
  useEffect(() => {
    if (!hasIncompletePanel) return;
    onLayoutChange((current) =>
      fillTradingViewNativeMultiChartPanels(
        normalizeTradingViewNativeMultiChartLayout(current),
        defaults.current,
      ),
    );
  }, [hasIncompletePanel, onLayoutChange]);

  const handlePresetChange = useCallback(
    (nextPreset: ITradingViewNativeMultiChartPreset) => {
      onLayoutChange((current) =>
        fillTradingViewNativeMultiChartPanels(
          {
            ...normalizeTradingViewNativeMultiChartLayout(current),
            preset: nextPreset,
          },
          defaults.current,
        ),
      );
    },
    [onLayoutChange],
  );
  const layoutControl = useMemo(
    () => (
      <TradingViewNativeMultiChartLayoutSelect
        preset={preset}
        onChange={handlePresetChange}
      />
    ),
    [handlePresetChange, preset],
  );

  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setGridSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);
  const [draft, setDraft] = useState<IResizeDraft | null>(null);
  // Persisting is asynchronous, so the released sizes stay on screen until the
  // saved layout has moved on.
  useEffect(() => {
    if (draft?.committedOver && draft.committedOver !== storedLayout) {
      setDraft(null);
    }
  }, [draft, storedLayout]);
  const sizes =
    draft?.preset === preset
      ? draft.sizes
      : getTradingViewNativeMultiChartSizes({
          availableSize: gridSize,
          layout,
        });
  const latest = useRef({ preset, sizes, gridSize, storedLayout });
  latest.current = { preset, sizes, gridSize, storedLayout };
  const activeResize = useRef<{
    axis: ITradingViewNativeMultiChartAxis;
    index: number;
    snapshot: typeof latest.current;
    sizes: ITradingViewNativeMultiChartSizes;
  } | null>(null);
  const handleResizeStart = useCallback(
    (axis: ITradingViewNativeMultiChartAxis, index: number) => {
      const snapshot = latest.current;
      activeResize.current = { axis, index, snapshot, sizes: snapshot.sizes };
    },
    [],
  );
  const handleResizeMove = useCallback((delta: number) => {
    const active = activeResize.current;
    if (!active) return;
    const { axis, index, snapshot } = active;
    active.sizes = {
      ...snapshot.sizes,
      [axis]: resizeTradingViewNativeMultiChartTracks({
        tracks: snapshot.sizes[axis],
        dividerIndex: index,
        delta,
        availableSize:
          axis === 'columns'
            ? snapshot.gridSize.width
            : snapshot.gridSize.height,
        minimumSize:
          axis === 'columns'
            ? TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_WIDTH
            : TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_HEIGHT,
      }),
    };
    setDraft({ preset: snapshot.preset, sizes: active.sizes });
  }, []);
  const handleResizeEnd = useCallback(
    (commit: boolean) => {
      const active = activeResize.current;
      activeResize.current = null;
      if (!active || !commit) {
        setDraft(null);
        return;
      }
      setDraft({
        preset: active.snapshot.preset,
        sizes: active.sizes,
        committedOver: latest.current.storedLayout,
      });
      onLayoutChange((current) =>
        setTradingViewNativeMultiChartSizes(
          normalizeTradingViewNativeMultiChartLayout(current),
          active.snapshot.preset,
          active.sizes,
        ),
      );
    },
    [onLayoutChange],
  );

  const rects = getTradingViewNativeMultiChartRects(preset, sizes);
  const dividers = getTradingViewNativeMultiChartDividers(preset, sizes);
  const dividerLabel = intl.formatMessage({
    id: ETranslations.perps_desktop_resize_panels__desc,
  });

  return (
    <Stack
      flex={1}
      width="100%"
      minHeight={0}
      position="relative"
      onLayout={handleGridLayout}
      testID={testID}
      data-preset={preset}
    >
      {panelIds.map((id, index) => {
        const rect = rects[index];
        const state = layout.panels[id];
        const source = index === 0 ? mainSource : state?.source;
        return (
          // The first panel keeps its tree position, so moving between presets
          // never remounts the host's chart.
          <Stack
            key={id}
            position="absolute"
            left={`${rect.left * 100}%`}
            top={`${rect.top * 100}%`}
            width={`${rect.width * 100}%`}
            height={`${rect.height * 100}%`}
            minHeight={0}
            overflow="hidden"
            testID={`${testID}-panel-${id}`}
          >
            {source ? (
              <Panel
                id={id}
                index={index}
                isSplit={isSplit}
                source={source}
                indicatorSettings={
                  state?.indicatorSettings ?? defaultIndicatorSettings
                }
                layoutControl={layoutControl}
                onLayoutChange={onLayoutChange}
                renderPanel={renderPanel}
              />
            ) : null}
          </Stack>
        );
      })}
      {dividers.map((divider) => (
        <TradingViewNativeMultiChartDivider
          key={`${divider.axis}:${divider.index}`}
          divider={divider}
          label={dividerLabel}
          onStart={handleResizeStart}
          onMove={handleResizeMove}
          onEnd={handleResizeEnd}
        />
      ))}
    </Stack>
  );
}
