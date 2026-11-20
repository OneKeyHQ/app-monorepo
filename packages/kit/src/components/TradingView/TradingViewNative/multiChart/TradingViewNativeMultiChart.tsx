import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { isEqual } from 'lodash';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartLayout,
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
  getTradingViewNativeMultiChartSourceOwnerPanelId,
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
  TRADING_VIEW_NATIVE_MULTI_CHART_KEEP_SELECTION_PROPS,
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

const KEEP_SELECTION_SELECTOR = Object.keys(
  TRADING_VIEW_NATIVE_MULTI_CHART_KEEP_SELECTION_PROPS,
)
  .map((name) => `[${name}]`)
  .join(',');

// Whether a press or key on `target` is one on the panel itself. An overlay
// the panel opened, e.g. a token list, is rendered elsewhere and only reaches
// the panel through React.
function isOnPanel(panel: Element, target: EventTarget): target is Element {
  return (
    target instanceof Element &&
    panel.contains(target) &&
    !target.closest(KEEP_SELECTION_SELECTOR)
  );
}

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
    onSourceChange,
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
    onSourceChange: (panelId: string, source: ITradingViewNativeSource) => void;
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
        onSourceChange(id, nextSource);
        onLayoutChange((current) =>
          updateTradingViewNativeMultiChartPanel(
            normalizeTradingViewNativeMultiChartLayout(current),
            id,
            { source: nextSource },
          ),
        );
      },
      [id, onLayoutChange, onSourceChange],
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

type IKeptSources = Partial<Record<string, ITradingViewNativeSource>>;

interface IPanelSelection {
  /** Tells a selection from the ones made before and after it. */
  seq: number;
  panelId: string;
  /**
   * Tokens of the panels selected before, which showed the host's source
   * without storing it and go on showing it. Collected until the saved layout
   * has them all, so every write is complete on its own; none for a panel that
   * has its own token saved while every panel shows the host's.
   */
  keptSources: IKeptSources;
  /** The selected panel's token, kept on screen until the host shows it. */
  source: ITradingViewNativeSource;
  /** The host's source when the panel was selected. */
  activeSourceKey: string;
  /**
   * The panel the host's source belonged to when this one was selected, and
   * goes on belonging to until the host follows.
   */
  hostPanelId: string;
  waitsForHost: boolean;
  /**
   * Written to the saved layout. A selection that waits for the host is only
   * saved once the host has followed, so one it turns down leaves nothing
   * behind, whether or not the grid is still mounted by then.
   */
  isSaved: boolean;
  /** The host turned the switch down. */
  isRejected?: boolean;
  /**
   * Where the host went last while the switch was on its way, e.g. for a newer
   * trade action, and whether the selected panel was on screen then.
   */
  hostMove?: { sourceKey: string; isShown: boolean };
  /**
   * The last saved selection, which a turned-down switch returns to. The host
   * has followed it, so it waits for nothing.
   */
  fallback: IPanelSelection | null;
}

// A token picked for a panel replaces the one a selection still holds for it.
function replaceKeptSource(
  selection: IPanelSelection | null,
  panelId: string,
  source: ITradingViewNativeSource,
): IPanelSelection | null {
  if (!selection) return selection;
  const fallback = replaceKeptSource(selection.fallback, panelId, source);
  const isKept = Boolean(selection.keptSources[panelId]);
  if (!isKept && fallback === selection.fallback) return selection;
  return {
    ...selection,
    fallback,
    keptSources: isKept
      ? { ...selection.keptSources, [panelId]: source }
      : selection.keptSources,
  };
}

// Compared as stored: on a split runtime the way to bg and back drops fields
// set to `undefined`, e.g. in a panel's indicator settings.
function isSameStoredLayout(
  a: ITradingViewNativeMultiChartLayout,
  b: ITradingViewNativeMultiChartLayout,
) {
  return isEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}

export function TradingViewNativeMultiChart({
  activeSource,
  defaultIndicatorSettings,
  getDefaultPanelSource,
  layout: storedLayout,
  onLayoutChange: onSavedLayoutChange,
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
  const [selection, setSelectionState] = useState<IPanelSelection | null>(null);
  // The host's answer can arrive before the next render, or after the grid is
  // unmounted, and has to save the selection as it is by then.
  const selectionRef = useRef(selection);
  const setSelection = useCallback((next: IPanelSelection | null) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);
  // The layout the grid wrote last, until the saved one has caught up with it.
  const writtenLayout = useRef<ITradingViewNativeMultiChartLayout | null>(null);
  useEffect(() => {
    if (
      writtenLayout.current &&
      isSameStoredLayout(writtenLayout.current, savedLayout)
    ) {
      writtenLayout.current = null;
    }
  }, [savedLayout]);
  // Every write of the grid. On a split runtime `current` is the snapshot bg
  // sent last and can miss writes still on their way there; a write worked out
  // from it, e.g. a selection saved after the preset changed, would undo them.
  // So each write starts from the layout written last.
  const onLayoutChange = useCallback<IOnLayoutChange>(
    (update) =>
      onSavedLayoutChange((current) => {
        const base = writtenLayout.current ?? current;
        const next = update(base);
        if (next === base) return current;
        writtenLayout.current =
          normalizeTradingViewNativeMultiChartLayout(next);
        return next;
      }),
    [onSavedLayoutChange],
  );
  const layout = useMemo(
    () =>
      selection
        ? selectTradingViewNativeMultiChartPanel(
            savedLayout,
            selection.panelId,
            selection.keptSources,
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
  // The host has not followed the selection yet.
  const awaitsHost =
    selection?.waitsForHost === true &&
    selection.activeSourceKey === activeSourceKey;
  const isWaitingForHost = awaitsHost && selection.panelId === activePanelId;
  const shownActiveSource = isWaitingForHost ? selection.source : activeSource;
  // The panel the host's own source belongs to: the selected one, also while
  // the preset hides it and the first panel stands in for it, but not one the
  // host has yet to follow.
  const hostPanelId = awaitsHost
    ? selection.hostPanelId
    : getTradingViewNativeMultiChartSourceOwnerPanelId(layout);
  const saveSelection = useCallback(
    (target: IPanelSelection) => {
      onLayoutChange((current) =>
        selectTradingViewNativeMultiChartPanel(
          normalizeTradingViewNativeMultiChartLayout(current),
          target.panelId,
          target.keptSources,
        ),
      );
    },
    [onLayoutChange],
  );
  // Decided after render, with the host's current source.
  useEffect(() => {
    if (!selection || selection !== selectionRef.current) return;
    const hostMoved = selection.activeSourceKey !== activeSourceKey;
    if (selection.isRejected) {
      // A newer trade action can have taken the host to another token. The
      // selected panel follows it when it is the panel's own token, or when
      // the panel was on screen as the host went there; a panel the preset
      // hid then showed none, so the token stays with the panel it belonged
      // to. A host back on its source returns the selection.
      const wasShown =
        selection.hostMove?.sourceKey === activeSourceKey
          ? selection.hostMove.isShown
          : selection.panelId === activePanelId;
      if (
        hostMoved &&
        (activeSourceKey === getTradingViewNativeSourceKey(selection.source) ||
          wasShown)
      ) {
        saveSelection(selection);
        setSelection({ ...selection, isRejected: false, isSaved: true });
      } else {
        setSelection(selection.fallback);
      }
      return;
    }
    if (!selection.isSaved) {
      // The host can show a token before it has switched to it, so only its
      // answer saves the selection. Until then, note who was on screen each
      // time it moves.
      if (hostMoved && selection.hostMove?.sourceKey !== activeSourceKey) {
        setSelection({
          ...selection,
          hostMove: {
            sourceKey: activeSourceKey,
            isShown: selection.panelId === activePanelId,
          },
        });
      }
      return;
    }
    if (layout === savedLayout && (!selection.waitsForHost || hostMoved)) {
      setSelection(null);
    }
  }, [
    activePanelId,
    activeSourceKey,
    layout,
    saveSelection,
    savedLayout,
    selection,
    setSelection,
  ]);

  const latestSelectionState = useRef({
    activeSource,
    activeSourceKey,
    hostPanelId,
    isSymbolSynced,
    layout,
    onSelectPanel,
    selection,
    shownActiveSource,
  });
  latestSelectionState.current = {
    activeSource,
    activeSourceKey,
    hostPanelId,
    isSymbolSynced,
    layout,
    onSelectPanel,
    selection,
    shownActiveSource,
  };
  const selectionSeq = useRef(0);
  // Switches the host was asked for and has not answered yet.
  const pendingSwitches = useRef(0);
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
      // The host's token stays with the panel it belongs to, which showed it
      // without storing it. A panel standing in for that one, or selected
      // without the host having followed, has its own token saved already.
      const { hostPanelId: keptPanelId } = state;
      const keepsOwnToken =
        state.isSymbolSynced &&
        Boolean(state.layout.panels[keptPanelId]?.source);
      const keptSources: IKeptSources = { ...state.selection?.keptSources };
      // A selection the host has not followed holds that panel's token
      // already: the host's, or one picked for the panel since, which is newer.
      if (!keepsOwnToken && !keptSources[keptPanelId]) {
        keptSources[keptPanelId] = state.activeSource;
      }
      // The selected panel follows the host from here on.
      delete keptSources[panelId];
      const waitsForHost =
        getTradingViewNativeSourceKey(source) !== state.activeSourceKey;
      selectionSeq.current += 1;
      const seq = selectionSeq.current;
      const next: IPanelSelection = {
        seq,
        panelId,
        keptSources,
        source,
        activeSourceKey: state.activeSourceKey,
        hostPanelId: keptPanelId,
        waitsForHost,
        isSaved: !waitsForHost,
        // A saved selection is never turned down, so it needs none itself.
        fallback: state.selection?.isSaved
          ? { ...state.selection, fallback: null, waitsForHost: false }
          : (state.selection?.fallback ?? null),
      };
      setSelection(next);
      if (!waitsForHost) {
        saveSelection(next);
        // The host shows this token already, but an earlier switch may still
        // land on another one: asking again makes the host drop that switch.
        if (pendingSwitches.current > 0) {
          void state.onSelectPanel(source).catch(() => false);
        }
        return;
      }
      pendingSwitches.current += 1;
      void state
        .onSelectPanel(source)
        .catch(() => false)
        .then((switched) => {
          pendingSwitches.current -= 1;
          const current = selectionRef.current;
          // Only while no newer selection replaced this one.
          if (current?.seq !== seq) return;
          // Saved from here, so it also lands once the grid is unmounted.
          if (switched) saveSelection(current);
          setSelection({
            ...current,
            ...(switched ? { isSaved: true } : { isRejected: true }),
          });
        });
    },
    [saveSelection, setSelection],
  );
  const handlePanelSourceChange = useCallback(
    (panelId: string, source: ITradingViewNativeSource) => {
      setSelection(replaceKeptSource(selectionRef.current, panelId, source));
    },
    [setSelection],
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
      const state = latestSelectionState.current;
      onLayoutChange((current) => {
        const saved = normalizeTradingViewNativeMultiChartLayout(current);
        const next = setTradingViewNativeMultiChartSync(
          saved,
          option,
          isSynced,
        );
        if (next === saved) return current;
        // From here every panel shows the host's token and keeps its own for
        // when that ends. The host's panel shows it without storing it, so
        // what it stores can date from before it was selected.
        return option === 'symbol' && isSynced
          ? updateTradingViewNativeMultiChartPanel(next, state.hostPanelId, {
              source: state.activeSource,
            })
          : next;
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
                        if (
                          event.button === 0 &&
                          isOnPanel(event.currentTarget, event.target)
                        ) {
                          handleSelectPanel(id);
                        }
                      }
                }
                // From the keyboard: Enter or Space on the focused chart.
                // The panel's controls, e.g. a drawing tool's style list, use
                // these keys themselves and leave the selection alone.
                onKeyDownCapture={
                  isActive
                    ? undefined
                    : (event) => {
                        const { target } = event;
                        if (
                          (event.key !== 'Enter' && event.key !== ' ') ||
                          event.altKey ||
                          event.ctrlKey ||
                          event.metaKey ||
                          !(target instanceof HTMLCanvasElement) ||
                          !isOnPanel(event.currentTarget, target)
                        ) {
                          return;
                        }
                        // Space would scroll the page.
                        event.preventDefault();
                        handleSelectPanel(id);
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
                      onSourceChange={handlePanelSourceChange}
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
