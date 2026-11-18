import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartPreset,
  ITradingViewNativeMultiChartSizes,
  ITradingViewNativeMultiChartSyncOption,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';

import { createTradingViewNativeCrosshairSyncChannel } from './crosshairSync';
import { createTradingViewNativeIntervalSync } from './intervalSync';
import {
  TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_HEIGHT,
  TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_WIDTH,
  fillTradingViewNativeMultiChartPanels,
  getTradingViewNativeMultiChartActivePanelId,
  getTradingViewNativeMultiChartDividers,
  getTradingViewNativeMultiChartPanelIds,
  getTradingViewNativeMultiChartRects,
  getTradingViewNativeMultiChartSizes,
  getTradingViewNativeMultiChartSync,
  hasUnfilledTradingViewNativeMultiChartPanel,
  normalizeTradingViewNativeMultiChartLayout,
  resizeTradingViewNativeMultiChartTracks,
  selectTradingViewNativeMultiChartPanel,
  setTradingViewNativeMultiChartSizes,
  setTradingViewNativeMultiChartSync,
  updateTradingViewNativeMultiChartPanel,
} from './multiChartLayout';
import { TradingViewNativeMultiChartDivider } from './TradingViewNativeMultiChartDivider';
import { TradingViewNativeMultiChartLayoutSelect } from './TradingViewNativeMultiChartLayoutSelect';
import {
  TradingViewNativeMultiChartControlsContext,
  TradingViewNativeMultiChartPanelContext,
} from './TradingViewNativeMultiChartPanelContext';
import { TradingViewNativeMultiChartSyncContext } from './TradingViewNativeMultiChartSyncContext';
import { createTradingViewNativeViewportSyncChannel } from './viewportSync';

import type { ITradingViewNativeMultiChartAxis } from './multiChartLayout';
import type {
  ITradingViewNativeMultiChartPanel,
  ITradingViewNativeMultiChartProps,
} from './TradingViewNativeMultiChart.types';
import type {
  ITradingViewNativeMultiChartControlsSlot,
  ITradingViewNativeMultiChartPanelScope,
} from './TradingViewNativeMultiChartPanelContext';
import type { ITradingViewNativeMultiChartSyncScope } from './TradingViewNativeMultiChartSyncContext';
import type { LayoutChangeEvent } from 'react-native';

type IOnLayoutChange = ITradingViewNativeMultiChartProps['onLayoutChange'];

function ignoreSourceChange() {}

const NO_CONTROLS_SLOT: ITradingViewNativeMultiChartControlsSlot = {
  renderControls: () => null,
};

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

type IPanelSync = Pick<
  ITradingViewNativeMultiChartSyncScope,
  'crosshair' | 'interval' | 'viewport'
>;

const Panel = memo(
  ({
    id,
    index,
    indicatorSettings,
    isActive,
    isSplit,
    isSymbolSynced,
    layoutControl,
    onLayoutChange,
    renderPanel,
    source,
    sync,
  }: {
    id: string;
    index: number;
    indicatorSettings: ITradingViewNativeIndicatorSettings;
    isActive: boolean;
    isSplit: boolean;
    isSymbolSynced: boolean;
    layoutControl: ReactNode;
    onLayoutChange: IOnLayoutChange;
    renderPanel: ITradingViewNativeMultiChartProps['renderPanel'];
    source: ITradingViewNativeSource;
    sync: IPanelSync;
  }) => {
    const isMain = index === 0;
    const instrumentKey = getTradingViewNativeSourceKey(source);
    const syncScope = useMemo<ITradingViewNativeMultiChartSyncScope>(
      () => ({ ...sync, isMain, instrumentKey }),
      [instrumentKey, isMain, sync],
    );
    const setSource = useCallback<
      ITradingViewNativeMultiChartPanel['setSource']
    >(
      (nextSource) => {
        onLayoutChange((current) =>
          updateTradingViewNativeMultiChartPanel(
            normalizeTradingViewNativeMultiChartLayout(current),
            id,
            { source: nextSource },
          ),
        );
      },
      [id, onLayoutChange],
    );
    const panel = useMemo<ITradingViewNativeMultiChartPanel>(
      () => ({
        id,
        index,
        isMain,
        isActive,
        isSplit,
        isSymbolSynced,
        source,
        layoutControl: isActive ? layoutControl : null,
        setSource: isActive ? ignoreSourceChange : setSource,
      }),
      [
        id,
        index,
        isActive,
        isMain,
        isSplit,
        isSymbolSynced,
        layoutControl,
        setSource,
        source,
      ],
    );
    const content = renderPanel(panel);
    // The provider stays mounted whatever the panels sync, so turning an
    // option on or off never remounts a chart.
    return (
      <TradingViewNativeMultiChartSyncContext.Provider value={syncScope}>
        {/* The first panel stays outside the scope: it keeps the host's own
            interval and indicators whether or not the view is split. */}
        {isMain ? (
          content
        ) : (
          <PanelScope
            panelId={id}
            indicatorSettings={indicatorSettings}
            onLayoutChange={onLayoutChange}
          >
            {content}
          </PanelScope>
        )}
      </TradingViewNativeMultiChartSyncContext.Provider>
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

interface IPanelSelection {
  panelId: string;
  previousPanelId: string;
  /** The selected panel's token, kept on screen until the host shows it. */
  source: ITradingViewNativeSource;
  /**
   * What the previously selected panel showed and goes on showing; none while
   * every panel shows the host's token and that panel has its own saved.
   */
  previousSource?: ITradingViewNativeSource;
  /** The host's source when the panel was selected. */
  activeSourceKey: string;
  waitsForHost: boolean;
  /** The host turned the switch down. */
  rejected?: boolean;
}

export function TradingViewNativeMultiChart({
  activeSource,
  defaultIndicatorSettings,
  getDefaultPanelSource,
  layout: storedLayout,
  onLayoutChange,
  onSelectPanel,
  renderPanel,
  testID = 'trading-view-multi-chart',
}: ITradingViewNativeMultiChartProps) {
  const intl = useIntl();
  const savedLayout = useMemo(
    () => normalizeTradingViewNativeMultiChartLayout(storedLayout),
    [storedLayout],
  );
  // A selection shows at once: the saved layout catches up asynchronously on
  // split runtimes, and the host can take a moment to switch its source.
  const [selection, setSelection] = useState<IPanelSelection | null>(null);
  const layout = useMemo(
    () =>
      selection
        ? selectTradingViewNativeMultiChartPanel(
            savedLayout,
            selection.panelId,
            selection.previousSource,
          )
        : savedLayout,
    [savedLayout, selection],
  );
  const { preset } = layout;
  const panelIds = useMemo(
    () => getTradingViewNativeMultiChartPanelIds(preset),
    [preset],
  );
  const isSplit = panelIds.length > 1;
  const sync = useMemo(
    () => getTradingViewNativeMultiChartSync(layout),
    [layout],
  );
  const isSymbolSynced = isSplit && sync.symbol;
  const activePanelId = getTradingViewNativeMultiChartActivePanelId(layout);
  const activeSourceKey = getTradingViewNativeSourceKey(activeSource);
  const isWaitingForHost =
    selection?.waitsForHost === true &&
    selection.panelId === activePanelId &&
    selection.activeSourceKey === activeSourceKey;
  const shownActiveSource = isWaitingForHost ? selection.source : activeSource;
  // Decided after render, with the host's current source.
  useEffect(() => {
    if (!selection) return;
    const hostMoved = selection.activeSourceKey !== activeSourceKey;
    if (selection.rejected && !hostMoved) {
      // The host kept its source, so the previous panel stays selected.
      setSelection(null);
      onLayoutChange((current) => ({
        ...normalizeTradingViewNativeMultiChartLayout(current),
        activePanelId: selection.previousPanelId,
      }));
      return;
    }
    if (
      savedLayout.activePanelId === selection.panelId &&
      (!selection.waitsForHost || hostMoved)
    ) {
      setSelection(null);
    }
  }, [activeSourceKey, onLayoutChange, savedLayout, selection]);

  const latestSelectionState = useRef({
    activeSourceKey,
    isSymbolSynced,
    layout,
    onSelectPanel,
    shownActiveSource,
  });
  latestSelectionState.current = {
    activeSourceKey,
    isSymbolSynced,
    layout,
    onSelectPanel,
    shownActiveSource,
  };
  const handleSelectPanel = useCallback(
    (panelId: string) => {
      const state = latestSelectionState.current;
      const previousPanelId = getTradingViewNativeMultiChartActivePanelId(
        state.layout,
      );
      if (panelId === previousPanelId) return;
      // With the token synced every panel shows the host's, so a selection
      // only moves the controls and keeps each panel's own token for later;
      // a panel without one keeps the token it showed.
      const source = state.isSymbolSynced
        ? state.shownActiveSource
        : state.layout.panels[panelId]?.source;
      if (!source) return;
      const keepsOwnToken =
        state.isSymbolSynced &&
        Boolean(state.layout.panels[previousPanelId]?.source);
      const next: IPanelSelection = {
        panelId,
        previousPanelId,
        source,
        previousSource: keepsOwnToken ? undefined : state.shownActiveSource,
        activeSourceKey: state.activeSourceKey,
        waitsForHost:
          getTradingViewNativeSourceKey(source) !== state.activeSourceKey,
      };
      setSelection(next);
      onLayoutChange((current) =>
        selectTradingViewNativeMultiChartPanel(
          normalizeTradingViewNativeMultiChartLayout(current),
          panelId,
          next.previousSource,
        ),
      );
      if (!next.waitsForHost) return;
      void state
        .onSelectPanel(source)
        .catch(() => false)
        .then((switched) => {
          if (switched) return;
          // Only while no newer selection replaced this one.
          setSelection((current) =>
            current === next ? { ...next, rejected: true } : current,
          );
        });
    },
    [onLayoutChange],
  );

  const defaults = useRef({
    activeSource,
    getDefaultPanelSource,
    indicatorSettings: defaultIndicatorSettings,
  });
  defaults.current = {
    activeSource,
    getDefaultPanelSource,
    indicatorSettings: defaultIndicatorSettings,
  };
  // Covers a layout saved without a panel's token or indicator settings, e.g.
  // by another build. The layout picker fills new panels itself.
  const hasIncompletePanel =
    hasUnfilledTradingViewNativeMultiChartPanel(savedLayout);
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
  const handleSyncChange = useCallback(
    (option: ITradingViewNativeMultiChartSyncOption, isSynced: boolean) => {
      onLayoutChange((current) => {
        const saved = normalizeTradingViewNativeMultiChartLayout(current);
        const next = setTradingViewNativeMultiChartSync(
          saved,
          option,
          isSynced,
        );
        return next === saved ? current : next;
      });
    },
    [onLayoutChange],
  );
  const crosshairSyncChannel = useMemo(
    () => createTradingViewNativeCrosshairSyncChannel(),
    [],
  );
  const viewportSyncChannel = useMemo(
    () => createTradingViewNativeViewportSyncChannel(),
    [],
  );
  // What every panel shares with the others. A part is rebuilt only when its
  // own option changes, so the charts keep the rest as it is.
  const isCrosshairSynced = isSplit && sync.crosshair;
  const isIntervalSynced = isSplit && sync.interval;
  const intervalSync = useMemo(
    // Started anew each time, from the first panel's interval.
    () => (isIntervalSynced ? createTradingViewNativeIntervalSync() : null),
    [isIntervalSynced],
  );
  const isViewportSynced = isSplit && (sync.time || sync.dateRange);
  const fitsDateRange = sync.dateRange;
  const viewportSync = useMemo(
    () =>
      isViewportSynced
        ? { channel: viewportSyncChannel, fitRange: fitsDateRange }
        : null,
    [fitsDateRange, isViewportSynced, viewportSyncChannel],
  );
  const panelSync = useMemo<IPanelSync>(
    () => ({
      crosshair: isCrosshairSynced ? crosshairSyncChannel : null,
      interval: intervalSync,
      viewport: viewportSync,
    }),
    [crosshairSyncChannel, intervalSync, isCrosshairSynced, viewportSync],
  );
  const layoutControl = useMemo(
    () => (
      <TradingViewNativeMultiChartLayoutSelect
        preset={preset}
        onChange={handlePresetChange}
        sync={sync}
        onSyncChange={handleSyncChange}
      />
    ),
    [handlePresetChange, handleSyncChange, preset, sync],
  );

  // One controls row for the whole grid: the selected panel's.
  const [controlsBar, setControlsBar] = useState<HTMLDivElement | null>(null);
  const activeControlsSlot = useMemo<ITradingViewNativeMultiChartControlsSlot>(
    () => ({
      renderControls: (controls) =>
        controlsBar ? createPortal(controls, controlsBar) : null,
    }),
    [controlsBar],
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
      testID={testID}
      data-preset={preset}
    >
      <div
        ref={setControlsBar}
        data-testid={`${testID}-controls`}
        style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
      />
      <Stack
        flex={1}
        width="100%"
        minHeight={0}
        position="relative"
        onLayout={handleGridLayout}
      >
        {panelIds.map((id, index) => {
          const rect = rects[index];
          const state = layout.panels[id];
          const isActive = id === activePanelId;
          // With the token synced, a panel keeps its own for when that ends.
          const source =
            isActive || isSymbolSynced ? shownActiveSource : state?.source;
          return (
            // Panels keep their tree position, so neither a preset change nor a
            // selection remounts a chart.
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
              data-selected={isSplit && isActive ? 'true' : undefined}
            >
              <div
                style={{ display: 'contents' }}
                // Capture: a press anywhere in the panel, also on a control of
                // its chart, selects it before the chart handles the press.
                onPointerDownCapture={
                  isActive
                    ? undefined
                    : (event) => {
                        if (event.button === 0) handleSelectPanel(id);
                      }
                }
              >
                <TradingViewNativeMultiChartControlsContext.Provider
                  value={isActive ? activeControlsSlot : NO_CONTROLS_SLOT}
                >
                  {source ? (
                    <Panel
                      id={id}
                      index={index}
                      isActive={isActive}
                      isSplit={isSplit}
                      isSymbolSynced={isSymbolSynced}
                      source={source}
                      sync={panelSync}
                      indicatorSettings={
                        state?.indicatorSettings ?? defaultIndicatorSettings
                      }
                      layoutControl={layoutControl}
                      onLayoutChange={onLayoutChange}
                      renderPanel={renderPanel}
                    />
                  ) : null}
                </TradingViewNativeMultiChartControlsContext.Provider>
              </div>
              {isSplit && isActive ? (
                <Stack
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  // Above the chart's toolbars and the dividers on its edges; it
                  // never takes a press.
                  zIndex={5}
                  pointerEvents="none"
                  borderWidth={1}
                  borderColor="$borderActive"
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
    </Stack>
  );
}
