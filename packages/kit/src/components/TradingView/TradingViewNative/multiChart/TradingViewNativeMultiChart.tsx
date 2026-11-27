import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeMultiChartPreset,
  ITradingViewNativeMultiChartSizes,
  ITradingViewNativeMultiChartSyncOption,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';
import {
  readDrawingToolsCollapsed,
  saveDrawingToolsCollapsed,
} from '../web/drawings/DrawingToolbar';

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
  TradingViewNativeMultiChartControlsContext,
  TradingViewNativeMultiChartPanelContext,
} from './TradingViewNativeMultiChartPanelContext';
import { TradingViewNativeMultiChartSyncContext } from './TradingViewNativeMultiChartSyncContext';
import { createTradingViewNativeViewportSyncChannel } from './viewportSync';

import type { ITradingViewNativeIntervalSync } from './intervalSync';
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

type IWriteLayout = (
  update: Parameters<IOnLayoutChange>[0],
  /**
   * Called when the write fails while it is still the one written last. The
   * write is taken back then: the next one starts from the write before it.
   * Without it, the next write carries a failed one along, e.g. a selection
   * that is still on screen.
   */
  onFailure?: () => void,
) => void;

// Whether a press or key on `target` is one on the panel itself. An overlay
// the panel opened, e.g. a chart's menu, is rendered elsewhere and only reaches
// the panel through React.
function isOnPanel(panel: Element, target: EventTarget): target is Element {
  return target instanceof Element && panel.contains(target);
}

interface IPendingSwitch {
  answer: Promise<boolean>;
  /** The host's source when the switch was asked for. */
  fromKey: string;
  /**
   * The host's source if the switch is turned down: the one it showed
   * before the switches still on their way.
   */
  returnKey: string;
  /** That source itself, the last one the host is known to have landed on. */
  returnSource: ITradingViewNativeSource;
  /**
   * The selection the switch decides: the one that asked for it, or the
   * latest one waiting for it since. It stays here when a newer selection
   * replaces it on screen, as the host can let the switch land all the same,
   * e.g. while it still looks up the newer one's token.
   */
  selection: IPanelSelection;
}

/** What a grid rendered last, for what happens after the render. */
interface IGridState {
  activeSource: ITradingViewNativeSource;
  activeSourceKey: string;
  hostPanelId: string;
  isSymbolSynced: boolean;
  layout: ITradingViewNativeMultiChartLayout;
  onSelectPanel: ITradingViewNativeMultiChartProps['onSelectPanel'];
  selection: IPanelSelection | null;
  shownActiveSource: ITradingViewNativeSource;
}

/** Where the latest selection of a layout lives: the grid that made it. */
interface ISelectionStore {
  ref: { current: IPanelSelection | null };
  set: (next: IPanelSelection | null) => void;
  state: { current: IGridState };
}

interface ILayoutChannel {
  /** The layout written last, until the saved layout has it. */
  written: ITradingViewNativeMultiChartLayout | null;
  /** The latest selection made in any grid of the layout. */
  selectionSeq: number;
  /** Switches the host was asked for and has not answered yet, by token. */
  switches: Map<string, IPendingSwitch>;
  /** The selection made last in any grid of the layout. */
  latest: ISelectionStore | null;
}

function createLayoutChannel(): ILayoutChannel {
  return { written: null, selectionSeq: 0, switches: new Map(), latest: null };
}

// What the grids of one saved layout share, by `layoutKey`. One unmounted and
// the next mounted, e.g. across a breakpoint, build on each other's writes
// still on their way, wait for the switches the other asked for, and a newer
// selection in either outdates the answer the other is waiting for.
const layoutChannels = new Map<string, ILayoutChannel>();

function getRevision(layout: ITradingViewNativeMultiChartLayout) {
  return layout.revision ?? 0;
}

// Whether the saved layout has a write: it is that write, or has a newer
// revision. Another window can save the same revision without it, e.g. when
// both windows wrote over the same layout.
function hasWrite(
  saved: ITradingViewNativeMultiChartLayout,
  written: ITradingViewNativeMultiChartLayout,
) {
  return (
    getRevision(saved) > getRevision(written) ||
    (saved.writeId !== undefined && saved.writeId === written.writeId)
  );
}

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

/** A panel's slot as the grid gives it; the panel adds its interval picker. */
type IGridControlsSlot = Omit<
  ITradingViewNativeMultiChartControlsSlot,
  'renderIntervalControl'
>;

interface IIntervalSyncState {
  /** Null while every panel keeps its own interval. */
  channel: ITradingViewNativeIntervalSync | null;
  /** More than one chart was on screen when this was worked out. */
  isSplit: boolean;
}

/**
 * The interval option as this page asked for it last, until the saved layout
 * has all the page wrote since.
 */
interface IIntervalSyncIntent {
  isSynced: boolean;
  /** Turned on: the interval saved with it, which the panels take at once. */
  start?: string;
}

const Panel = memo(
  ({
    controlsSlot,
    id,
    index,
    indicatorSettings,
    isActive,
    isSplit,
    isSymbolSynced,
    layoutControl,
    onIntervalReport,
    onLayoutChange,
    onSelectSource,
    renderPanel,
    source,
    sync,
  }: {
    controlsSlot: IGridControlsSlot;
    id: string;
    index: number;
    indicatorSettings: ITradingViewNativeIndicatorSettings;
    isActive: boolean;
    isSplit: boolean;
    isSymbolSynced: boolean;
    layoutControl: ReactNode;
    onIntervalReport: (panelId: string, interval: string | undefined) => void;
    onLayoutChange: IOnLayoutChange;
    onSelectSource: (panelId: string, source: ITradingViewNativeSource) => void;
    renderPanel: ITradingViewNativeMultiChartProps['renderPanel'];
    source: ITradingViewNativeSource;
    sync: IPanelSync;
  }) => {
    const isMain = index === 0;
    const instrumentKey = getTradingViewNativeSourceKey(source);
    const reportInterval = useCallback(
      (interval: string | undefined) => onIntervalReport(id, interval),
      [id, onIntervalReport],
    );
    const syncScope = useMemo<ITradingViewNativeMultiChartSyncScope>(
      () => ({ ...sync, isMain, reportInterval, instrumentKey }),
      [instrumentKey, isMain, reportInterval, sync],
    );
    // Where the host placed `intervalControl`. It generates no box, so the
    // picker lays out as one of the host's own items, e.g. in its header row.
    const [intervalSlot, setIntervalSlot] = useState<HTMLElement | null>(null);
    const intervalControl = useMemo(
      () => <span ref={setIntervalSlot} style={{ display: 'contents' }} />,
      [],
    );
    const slot = useMemo<ITradingViewNativeMultiChartControlsSlot>(
      () => ({
        ...controlsSlot,
        renderIntervalControl: (control) =>
          intervalSlot ? createPortal(control, intervalSlot) : null,
      }),
      [controlsSlot, intervalSlot],
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
        intervalControl,
        selectSource: (picked) => onSelectSource(id, picked),
      }),
      [
        id,
        index,
        intervalControl,
        isActive,
        isMain,
        isSplit,
        isSymbolSynced,
        layoutControl,
        onSelectSource,
        source,
      ],
    );
    const content = renderPanel(panel);
    // The providers stay mounted whatever the panels sync and whichever is
    // selected, so neither an option nor a selection remounts a chart.
    return (
      <TradingViewNativeMultiChartControlsContext.Provider value={slot}>
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
      </TradingViewNativeMultiChartControlsContext.Provider>
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

// Where a maximized panel goes: over the whole grid.
const FULL_GRID_RECT = { left: 0, top: 0, width: 1, height: 1 };

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
   * Where a turned-down switch leaves the host: the source it showed before
   * the switches still on their way, which can be other than the one it
   * showed when the panel was selected.
   */
  returnSourceKey: string;
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

export function TradingViewNativeMultiChart({
  activeSource,
  defaultIndicatorSettings,
  getDefaultPanelSource,
  layout: storedLayout,
  layoutKey,
  onLayoutChange: onSavedLayoutChange,
  onSelectPanel,
  onSelectedPanelIdChange,
  renderPanel,
  selectedPanelId,
  testID = 'trading-view-multi-chart',
}: ITradingViewNativeMultiChartProps) {
  const intl = useIntl();
  const savedLayout = useMemo(
    () => normalizeTradingViewNativeMultiChartLayout(storedLayout),
    [storedLayout],
  );
  // What the grid shares with the other grids of its layout key.
  const [ownChannel] = useState(createLayoutChannel);
  const channel = useMemo(() => {
    if (!layoutKey) return ownChannel;
    let shared = layoutChannels.get(layoutKey);
    if (!shared) {
      shared = createLayoutChannel();
      layoutChannels.set(layoutKey, shared);
    }
    return shared;
  }, [layoutKey, ownChannel]);
  // A selection shows at once: the saved layout catches up asynchronously on
  // split runtimes, and the host can take a moment to switch its source.
  const [selection, setSelectionState] = useState<IPanelSelection | null>(null);
  // The host's answer can arrive before the next render, or after the grid is
  // unmounted, and has to save the selection as it is by then.
  const selectionRef = useRef(selection);
  const setSelection = useCallback(
    (next: IPanelSelection | null) => {
      selectionRef.current = next;
      // The switch that decides the selection keeps it as it is now.
      if (next) {
        for (const pending of channel.switches.values()) {
          if (pending.selection.seq === next.seq) pending.selection = next;
        }
      }
      setSelectionState(next);
    },
    [channel],
  );
  // The page that turns the interval option on or off acts on it at once, so
  // nothing done before the saved layout is back, e.g. picking an interval or
  // selecting another panel, meets charts that are not synced as the switch
  // shows. A saved layout that has only an earlier write of the page, e.g. the
  // option turned on and then off again, is not the page's choice either.
  const [intervalSyncIntent, setIntervalSyncIntent] =
    useState<IIntervalSyncIntent | null>(null);
  // A write is on its way until the saved layout has it: the write came back,
  // or a newer revision was saved over it, e.g. by another window.
  useEffect(() => {
    if (channel.written && hasWrite(savedLayout, channel.written)) {
      channel.written = null;
    }
    // The saved layout has all this grid wrote, or a write of another page
    // over it: it is what the option is from here.
    if (!channel.written) setIntervalSyncIntent(null);
  }, [channel, savedLayout]);
  useEffect(
    () => () => {
      // Shared writes stay for a late write of this grid or the next grid of
      // the layout. Without a key nothing builds on them any more, and a write
      // made from here on, e.g. a selection the host answers late, starts from
      // the latest saved layout.
      if (!layoutKey) channel.written = null;
    },
    [channel, layoutKey],
  );
  // Every write of the grid. On a split runtime `current` is the snapshot bg
  // sent last and can miss writes still on their way there; a write worked out
  // from it, e.g. a selection saved after the preset changed, would undo them.
  // So each write starts from the layout written last while the saved one does
  // not have it, and carries the next revision and an ID of its own.
  const onLayoutChange = useCallback<IWriteLayout>(
    (update, onFailure) => {
      let written: ITradingViewNativeMultiChartLayout | null = null;
      let builtOn: ITradingViewNativeMultiChartLayout | null = null;
      const result = onSavedLayoutChange((current) => {
        const pending = channel.written;
        const base = pending && !hasWrite(current, pending) ? pending : current;
        const next = update(base);
        if (next === base) return current;
        written = {
          ...normalizeTradingViewNativeMultiChartLayout(next),
          revision: Math.max(getRevision(base), getRevision(current)) + 1,
          writeId: generateUUID(),
        };
        builtOn = base === pending ? pending : null;
        channel.written = written;
        return written;
      });
      if (!onFailure) return;
      void Promise.resolve(result).catch(() => {
        if (!written || channel.written !== written) return;
        channel.written = builtOn;
        onFailure();
      });
    },
    [channel, onSavedLayoutChange],
  );
  // The saved layout as this page sees it, with the panel selected here. A
  // host that shares the saved layout with other pages, e.g. extension tabs,
  // keeps that panel beside its source: another page's selection comes with
  // that page's source, and followed here its panel would show this page's
  // token, which the next selection would then save over the panel's own.
  const savedOwnerPanelId =
    getTradingViewNativeMultiChartSourceOwnerPanelId(savedLayout);
  const ownPanelId = selectedPanelId ?? savedOwnerPanelId;
  // Kept from the first layout the page sees, e.g. after a reload, and from
  // then on moved by this page's selections only.
  useEffect(() => {
    if (selectedPanelId === undefined) {
      onSelectedPanelIdChange?.(savedOwnerPanelId);
    }
  }, [onSelectedPanelIdChange, savedOwnerPanelId, selectedPanelId]);
  const pageLayout = useMemo(
    () =>
      savedOwnerPanelId === ownPanelId
        ? savedLayout
        : { ...savedLayout, activePanelId: ownPanelId },
    [ownPanelId, savedLayout, savedOwnerPanelId],
  );
  const layout = useMemo(
    () =>
      selection
        ? selectTradingViewNativeMultiChartPanel(
            pageLayout,
            selection.panelId,
            selection.keptSources,
          )
        : pageLayout,
    [pageLayout, selection],
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
  // Whether the selected panel was on screen when the host went to its
  // current source.
  const wasShownOnHostMove =
    selection?.hostMove?.sourceKey === activeSourceKey
      ? selection.hostMove.isShown
      : selection?.panelId === activePanelId;
  // The host went to another token than the one it was asked for while the
  // selected panel was off screen, e.g. from its picker in the first panel
  // standing in for a hidden one: the token is not that panel's.
  const hostPassedSelection =
    selection !== null &&
    !selection.isSaved &&
    selection.activeSourceKey !== activeSourceKey &&
    activeSourceKey !== getTradingViewNativeSourceKey(selection.source) &&
    !wasShownOnHostMove;
  // The panel the host's own source belongs to: the selected one, also while
  // the preset hides it and the first panel stands in for it, but not one the
  // host has yet to follow or has passed by.
  const hostPanelId =
    selection && (awaitsHost || hostPassedSelection)
      ? selection.hostPanelId
      : getTradingViewNativeMultiChartSourceOwnerPanelId(layout);
  const saveSelection = useCallback(
    (target: IPanelSelection) => {
      onSelectedPanelIdChange?.(target.panelId);
      onLayoutChange((current) =>
        selectTradingViewNativeMultiChartPanel(
          normalizeTradingViewNativeMultiChartLayout(current),
          target.panelId,
          target.keptSources,
        ),
      );
    },
    [onLayoutChange, onSelectedPanelIdChange],
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
      // to. A host back where the turned-down switches leave it returns the
      // selection.
      if (
        activeSourceKey !== selection.returnSourceKey &&
        !hostPassedSelection
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
    // The page's layout has it all: the panel, and the tokens it kept.
    if (layout === pageLayout && (!selection.waitsForHost || hostMoved)) {
      setSelection(null);
    }
  }, [
    activePanelId,
    activeSourceKey,
    hostPassedSelection,
    layout,
    pageLayout,
    saveSelection,
    selection,
    setSelection,
  ]);

  const latestSelectionState = useRef<IGridState>({
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
  const selectionStore = useMemo<ISelectionStore>(
    () => ({
      ref: selectionRef,
      set: setSelection,
      state: latestSelectionState,
    }),
    [setSelection],
  );
  // The host answered a switch. It decides the selection waiting for it,
  // which can be one a newer selection has replaced on screen since.
  const settleSwitch = useCallback(
    (settled: IPendingSwitch, switched: boolean) => {
      const { switches } = channel;
      const store = channel.latest;
      const current = store?.ref.current ?? null;
      const waiting = settled.selection;
      // Only for the latest selection, in whichever grid of the layout.
      if (!store || !current || current.seq !== channel.selectionSeq) return;
      const state = store.state.current;
      if (current.seq === waiting.seq) {
        if (switched) {
          // Saved from here, so it also lands once the grid is unmounted.
          saveSelection(current);
          store.set({ ...current, isSaved: true });
          return;
        }
        // The host can turn a switch down before it begins, e.g. for a token
        // it cannot trade yet, and that leaves the switch asked before on
        // its way: the host still shows that one's token, or the one it
        // started from. Its answer decides then, for the selection it is for.
        const earlier = [...switches.values()].at(-1);
        if (
          !earlier ||
          (state.activeSourceKey !== earlier.fromKey &&
            state.activeSourceKey !==
              getTradingViewNativeSourceKey(earlier.selection.source))
        ) {
          store.set({ ...current, isRejected: true });
          return;
        }
        channel.selectionSeq += 1;
        const restored = { ...earlier.selection, seq: channel.selectionSeq };
        earlier.selection = restored;
        store.set(restored);
        return;
      }
      // The switch landed after a newer selection replaced its own, which
      // the host has yet to follow: the token is the panel's all the same,
      // and what the newer selection leaves behind.
      const landedKey = getTradingViewNativeSourceKey(waiting.source);
      if (
        !switched ||
        current.isSaved ||
        getTradingViewNativeSourceKey(current.source) === landedKey
      ) {
        return;
      }
      saveSelection(waiting);
      const keptSources: IKeptSources = { ...current.keptSources };
      // As in a selection: with the token synced, a panel keeps its own.
      if (
        state.isSymbolSynced &&
        state.layout.panels[waiting.panelId]?.source
      ) {
        delete keptSources[waiting.panelId];
      } else {
        keptSources[waiting.panelId] = waiting.source;
      }
      delete keptSources[current.panelId];
      const rebased: IPanelSelection = {
        ...current,
        keptSources,
        activeSourceKey: landedKey,
        returnSourceKey: landedKey,
        hostPanelId: waiting.panelId,
        hostMove: undefined,
        fallback: {
          ...waiting,
          isSaved: true,
          waitsForHost: false,
          fallback: null,
        },
      };
      // The newer selection's own switch now starts from the landed token.
      const own = switches.get(getTradingViewNativeSourceKey(current.source));
      if (own?.selection.seq === current.seq) {
        own.fromKey = landedKey;
        own.returnKey = landedKey;
        own.returnSource = waiting.source;
      }
      store.set(rebased);
    },
    [channel, saveSelection],
  );
  // `picked` is a token picked in the panel, which it takes on with the
  // selection; without one the panel keeps its own.
  const handleSelectPanel = useCallback(
    (panelId: string, picked?: ITradingViewNativeSource) => {
      const state = latestSelectionState.current;
      const previousPanelId = getTradingViewNativeMultiChartActivePanelId(
        state.layout,
      );
      if (panelId === previousPanelId && !picked) return;
      // With the token synced every panel shows the host's, so a selection
      // only moves the controls and keeps each panel's own token for later;
      // a panel without one keeps the token it showed.
      const source =
        picked ??
        (state.isSymbolSynced
          ? state.shownActiveSource
          : state.layout.panels[panelId]?.source);
      if (!source) return;
      const { switches } = channel;
      // The switch on its way to the token the host shows, which may show a
      // token before it lands.
      const shownSwitch = switches.get(state.activeSourceKey);
      // The host's token stays with the panel it belongs to, which showed it
      // without storing it. A token the host shows on its way there is no
      // panel's until its switch lands, e.g. one picked in the selected panel
      // that this selection supersedes: until then the host's token is the
      // one it returns to, in the panel the selection before found it in.
      const keptPanelId =
        shownSwitch && state.selection && !state.selection.isSaved
          ? state.selection.hostPanelId
          : state.hostPanelId;
      const keptSource = shownSwitch?.returnSource ?? state.activeSource;
      // A panel standing in for the host's, or with every panel showing the
      // host's token, has its own token saved already, which is newer than
      // any the selections before kept for it.
      const keepsOwnToken =
        state.isSymbolSynced &&
        Boolean(state.layout.panels[keptPanelId]?.source);
      const keptSources: IKeptSources = { ...state.selection?.keptSources };
      if (keepsOwnToken) delete keptSources[keptPanelId];
      else keptSources[keptPanelId] = keptSource;
      // The selected panel follows the host from here on.
      delete keptSources[panelId];
      const sourceKey = getTradingViewNativeSourceKey(source);
      // With the token the host shows, e.g. asked for by the press that
      // opened a picker in the panel, the switch on its way decides this
      // selection too: asking again would drop it for one that finds the host
      // halfway there. A switch the host has left for another token is
      // turned down, so this token is asked for anew.
      const pending = sourceKey === state.activeSourceKey ? shownSwitch : null;
      const fromKey = pending?.fromKey ?? state.activeSourceKey;
      const returnKey = shownSwitch?.returnKey ?? state.activeSourceKey;
      const returnSource = shownSwitch?.returnSource ?? state.activeSource;
      const waitsForHost = sourceKey !== fromKey;
      channel.selectionSeq += 1;
      const next: IPanelSelection = {
        seq: channel.selectionSeq,
        panelId,
        keptSources,
        source,
        activeSourceKey: fromKey,
        returnSourceKey: returnKey,
        hostPanelId: keptPanelId,
        waitsForHost,
        isSaved: !waitsForHost,
        // A saved selection is never turned down, so it needs none itself.
        fallback: state.selection?.isSaved
          ? { ...state.selection, fallback: null, waitsForHost: false }
          : (state.selection?.fallback ?? null),
      };
      channel.latest = selectionStore;
      setSelection(next);
      if (!waitsForHost) {
        saveSelection(next);
        // The host shows this token already, but an earlier switch may still
        // land on another one: asking again makes the host drop that switch.
        // A token picked in the panel is asked for in any case: the host can
        // show it without holding its market, e.g. after another page took
        // that, and only the host can tell.
        if (switches.size > 0 || picked) {
          void state.onSelectPanel(source).catch(() => false);
        }
        return;
      }
      if (pending) {
        pending.selection = next;
        return;
      }
      const asked: IPendingSwitch = {
        answer: state.onSelectPanel(source).catch(() => false),
        fromKey,
        returnKey,
        returnSource,
        selection: next,
      };
      switches.set(sourceKey, asked);
      void asked.answer.then((switched) => {
        if (switches.get(sourceKey) === asked) switches.delete(sourceKey);
        settleSwitch(asked, switched);
      });
    },
    [channel, saveSelection, selectionStore, setSelection, settleSwitch],
  );

  // The panel that fills the grid, and the preset it did so in. A view of
  // the grid only: it is never saved, so a reload or another window shows the
  // split as saved.
  const [maximized, setMaximized] = useState<{
    panelId: string;
    preset: ITradingViewNativeMultiChartPreset;
  } | null>(null);
  // Only the selected panel stays maximized: the controls row and drawing
  // tools on screen are its own. Another preset, or a selection that went
  // elsewhere, e.g. back from a switch the host turned down, ends it.
  const maximizedPanelId =
    isSplit &&
    maximized?.preset === preset &&
    maximized.panelId === activePanelId
      ? maximized.panelId
      : null;
  useEffect(() => {
    // For good, so a later selection or preset does not bring it back.
    if (maximized && maximizedPanelId === null) setMaximized(null);
  }, [maximized, maximizedPanelId]);
  const latestMaximize = useRef({ maximizedPanelId, preset });
  latestMaximize.current = { maximizedPanelId, preset };
  const toggleMaximized = useCallback(
    (panelId: string) => {
      const current = latestMaximize.current;
      if (current.maximizedPanelId === panelId) {
        setMaximized(null);
        return;
      }
      // A press on the panel has selected it already; the keyboard has not.
      handleSelectPanel(panelId);
      setMaximized({ panelId, preset: current.preset });
    },
    [handleSelectPanel],
  );
  const maximizedIndex =
    maximizedPanelId === null ? -1 : panelIds.indexOf(maximizedPanelId);

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
  // Which panels need a token of their own goes by the panel selected on
  // this page, which shows the host's: the one another page selected shows
  // its own token here. The saved selection stays that page's.
  const latestSelectedPanelId = useRef(selectedPanelId);
  latestSelectedPanelId.current = selectedPanelId;
  const fillPanels = useCallback(
    (saved: ITradingViewNativeMultiChartLayout) => {
      const own = latestSelectedPanelId.current;
      const { panels } = fillTradingViewNativeMultiChartPanels(
        own ? { ...saved, activePanelId: own } : saved,
        defaults.current,
      );
      return panels === saved.panels ? saved : { ...saved, panels };
    },
    [],
  );
  // Covers a layout saved without a panel's token or indicator settings, e.g.
  // by another build or by a page with another panel selected. The layout
  // picker fills new panels itself.
  const hasIncompletePanel =
    hasUnfilledTradingViewNativeMultiChartPanel(pageLayout);
  useEffect(() => {
    if (!hasIncompletePanel) return;
    onLayoutChange((current) => {
      const saved = normalizeTradingViewNativeMultiChartLayout(current);
      const filled = fillPanels(saved);
      return filled === saved ? current : filled;
    });
  }, [fillPanels, hasIncompletePanel, onLayoutChange]);

  const handlePresetChange = useCallback(
    (nextPreset: ITradingViewNativeMultiChartPreset) => {
      onLayoutChange((current) =>
        fillPanels({
          ...normalizeTradingViewNativeMultiChartLayout(current),
          preset: nextPreset,
        }),
      );
    },
    [fillPanels, onLayoutChange],
  );
  // The interval each panel's chart is on, as the charts report it.
  const panelIntervals = useRef(new Map<string, string>());
  const handleIntervalReport = useCallback(
    (panelId: string, interval: string | undefined) => {
      if (interval === undefined) panelIntervals.current.delete(panelId);
      else panelIntervals.current.set(panelId, interval);
    },
    [],
  );
  const handleSyncChange = useCallback(
    (option: ITradingViewNativeMultiChartSyncOption, isSynced: boolean) => {
      const state = latestSelectionState.current;
      // The intervals sync to the chart the option is turned on in: the
      // selected one, whose controls hold it. Read now and saved with the
      // option, as the selection can move on before the saved layout is
      // back, and another page showing the layout has a selection of its own.
      const readSelectedInterval = () =>
        panelIntervals.current.get(
          getTradingViewNativeMultiChartActivePanelId(
            latestSelectionState.current.layout,
          ),
        );
      const intervalStart =
        option === 'interval' && isSynced ? readSelectedInterval() : undefined;
      if (option === 'interval') {
        setIntervalSyncIntent(
          isSynced ? { isSynced, start: intervalStart } : { isSynced },
        );
      }
      // The host can have answered since the last render.
      const latestSelection = selectionRef.current;
      if (option === 'symbol' && isSynced && latestSelection) {
        // The host's panel is about to store the host's token. A selection on
        // its way, and the one it would return to, must not write the token
        // they kept for that panel back over it.
        const dropKept = (target: IPanelSelection): IPanelSelection => {
          if (!target.keptSources[state.hostPanelId]) return target;
          const keptSources = { ...target.keptSources };
          delete keptSources[state.hostPanelId];
          return { ...target, keptSources };
        };
        const fallback =
          latestSelection.fallback && dropKept(latestSelection.fallback);
        const next = dropKept(latestSelection);
        if (next !== latestSelection || fallback !== latestSelection.fallback) {
          setSelection({ ...next, fallback });
        }
        // Nor the ones a switch still on its way can bring back.
        for (const pending of channel.switches.values()) {
          if (pending.selection.seq !== latestSelection.seq) {
            pending.selection = dropKept(pending.selection);
          }
        }
      }
      onLayoutChange(
        (current) => {
          const saved = normalizeTradingViewNativeMultiChartLayout(current);
          const next = setTradingViewNativeMultiChartSync(
            saved,
            option,
            isSynced,
            intervalStart,
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
        },
        // The panels followed the option at the press. If it is not saved,
        // the option is as the next edit finds it: in the write of this page
        // still on its way, or in the saved layout, which another page can
        // have changed meanwhile. Synced again, the panels start from the
        // selected chart as at a press: the interval saved with the option
        // can be one they have left since.
        option === 'interval'
          ? () => {
              const saved = latestSelectionState.current.layout;
              const { written } = channel;
              const kept =
                written && !hasWrite(saved, written) ? written : saved;
              setIntervalSyncIntent(
                getTradingViewNativeMultiChartSync(kept).interval
                  ? { isSynced: true, start: readSelectedInterval() }
                  : { isSynced: false },
              );
            }
          : undefined,
      );
    },
    [channel, onLayoutChange, setSelection],
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
  const isIntervalOptionOn = intervalSyncIntent
    ? intervalSyncIntent.isSynced
    : sync.interval;
  const isIntervalSynced = isSplit && isIntervalOptionOn;
  // A split view that opens with the option on starts from the first panel,
  // the one chart on screen until then.
  const [intervalSync, setIntervalSync] = useState<IIntervalSyncState>(() => ({
    channel: isIntervalSynced ? createTradingViewNativeIntervalSync() : null,
    isSplit,
  }));
  if (
    intervalSync.isSplit !== isSplit ||
    (intervalSync.channel !== null) !== isIntervalSynced
  ) {
    // Started anew each time. In a view that was split already, it is the
    // option that was turned on: the panels take the interval saved with it,
    // at the press on this page and as the option arrives on another one. An
    // interval saved for an earlier start is not what a view opened since
    // shows.
    let start: string | undefined;
    if (intervalSync.isSplit) {
      start = intervalSyncIntent
        ? intervalSyncIntent.start
        : layout.intervalSyncStart;
    }
    setIntervalSync({
      channel: isIntervalSynced
        ? createTradingViewNativeIntervalSync(start)
        : null,
      isSplit,
    });
  }
  const intervalSyncChannel = intervalSync.channel;
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
      interval: intervalSyncChannel,
      viewport: viewportSync,
    }),
    [
      crosshairSyncChannel,
      intervalSyncChannel,
      isCrosshairSynced,
      viewportSync,
    ],
  );
  // The interval option shows what the panels do, from the press on.
  const shownSync = useMemo(
    () =>
      sync.interval === isIntervalOptionOn
        ? sync
        : { ...sync, interval: isIntervalOptionOn },
    [isIntervalOptionOn, sync],
  );
  const layoutControl = useMemo(
    () => (
      <TradingViewNativeMultiChartLayoutSelect
        preset={preset}
        onChange={handlePresetChange}
        sync={shownSync}
        onSyncChange={handleSyncChange}
      />
    ),
    [handlePresetChange, handleSyncChange, preset, shownSync],
  );

  // One controls row and one drawing tools column for the whole grid: the
  // selected panel's.
  const [controlsBar, setControlsBar] = useState<HTMLDivElement | null>(null);
  const [drawingToolsColumn, setDrawingToolsColumn] =
    useState<HTMLDivElement | null>(null);
  const [isDrawingToolsCollapsed, setIsDrawingToolsCollapsed] = useState(
    readDrawingToolsCollapsed,
  );
  const handleDrawingToolsCollapsedChange = useCallback(
    (isCollapsed: boolean) => {
      setIsDrawingToolsCollapsed(isCollapsed);
      saveDrawingToolsCollapsed(isCollapsed);
    },
    [],
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
  // The track sizes of a grid `width` wide: the released ones until they are
  // saved, or else the saved ones kept above the minimum panel size.
  const getSizes = (width: number) =>
    draft?.preset === preset
      ? draft.sizes
      : getTradingViewNativeMultiChartSizes({
          availableSize: { width, height: gridSize.height },
          layout,
        });
  const sizes = getSizes(gridSize.width);
  const latest = useRef({ preset, sizes, gridSize, storedLayout });
  latest.current = { preset, sizes, gridSize, storedLayout };
  // The panels' places for track `sizes`, a maximized panel over the grid.
  const getRects = (trackSizes: ITradingViewNativeMultiChartSizes) => {
    const gridRects = getTradingViewNativeMultiChartRects(preset, trackSizes);
    return maximizedIndex < 0
      ? gridRects
      : gridRects.map((rect, index) =>
          index === maximizedIndex ? FULL_GRID_RECT : rect,
        );
  };
  const getPanelWidth = (index: number, width: number) =>
    (getRects(getSizes(width))[index]?.width ?? 0) * width;
  const latestGetPanelWidth = useRef(getPanelWidth);
  latestGetPanelWidth.current = getPanelWidth;
  // Collapsing the column widens the grid, and a panel by what its tracks
  // take of that: nothing while they are held at the minimum panel width.
  const getDrawingToolsCollapseGain = useCallback(
    (index: number) => {
      const row = drawingToolsColumn?.parentElement;
      if (!drawingToolsColumn || !row) return 0;
      const columnWidth = drawingToolsColumn.offsetWidth;
      const gridWidth = row.offsetWidth - columnWidth;
      if (columnWidth <= 0 || gridWidth <= 0) return 0;
      const getWidth = latestGetPanelWidth.current;
      return Math.max(
        0,
        getWidth(index, gridWidth + columnWidth) - getWidth(index, gridWidth),
      );
    },
    [drawingToolsColumn],
  );
  // Each panel's slot while it is selected and while it is not, so a
  // selection gives a new one only to the two panels it moves between.
  const controlsSlots = useMemo(() => {
    const createSlot = (
      index: number,
      isActive: boolean,
    ): IGridControlsSlot => ({
      renderControls: (controls) =>
        isActive && controlsBar ? createPortal(controls, controlsBar) : null,
      drawingTools: {
        container: isActive ? drawingToolsColumn : null,
        isCollapsed: isDrawingToolsCollapsed,
        onCollapsedChange: handleDrawingToolsCollapsedChange,
        getCollapseGain: () => getDrawingToolsCollapseGain(index),
      },
      maximize: isSplit
        ? {
            isMaximized: index === maximizedIndex,
            toggle: () => toggleMaximized(panelIds[index]),
          }
        : undefined,
    });
    return panelIds.map((_, index) => ({
      active: createSlot(index, true),
      inactive: createSlot(index, false),
    }));
  }, [
    controlsBar,
    drawingToolsColumn,
    getDrawingToolsCollapseGain,
    handleDrawingToolsCollapsedChange,
    isDrawingToolsCollapsed,
    isSplit,
    maximizedIndex,
    panelIds,
    toggleMaximized,
  ]);
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
  // Maximizing takes the dividers away, also one still being dragged, e.g.
  // when Enter on a focused corner button maximizes mid-drag. That drag never
  // ends on its own, so it ends here without saving its sizes.
  useEffect(() => {
    if (maximizedPanelId !== null && activeResize.current) {
      handleResizeEnd(false);
    }
  }, [handleResizeEnd, maximizedPanelId]);

  const rects = getRects(sizes);
  // A maximized panel has no panel beside it to resize against.
  const dividers =
    maximizedPanelId === null
      ? getTradingViewNativeMultiChartDividers(preset, sizes)
      : [];
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
      {/* The tools' menus and toggle are placed against this row, so they
      reach over the panels. */}
      <Stack
        flex={1}
        width="100%"
        minHeight={0}
        flexDirection="row"
        position="relative"
      >
        <div
          ref={setDrawingToolsColumn}
          data-testid={`${testID}-drawing-tools`}
          // Above the panels' outline and dividers, so a tool menu stays on top.
          style={{ display: 'flex', flexShrink: 0, zIndex: 6 }}
        />
        <Stack
          flex={1}
          minWidth={0}
          minHeight={0}
          position="relative"
          // A stacking context of its own: the outline and dividers are ordered
          // among the panels only, so a control the page lays over the grid's
          // edge, e.g. a collapse toggle, stays on top of them.
          zIndex={0}
          onLayout={handleGridLayout}
        >
          {panelIds.map((id, index) => {
            const rect = rects[index];
            const state = layout.panels[id];
            const isActive = id === activePanelId;
            const isMaximized = id === maximizedPanelId;
            // Behind a maximized panel the others stay mounted at their size,
            // so the split comes back without a chart resizing.
            const isCovered = maximizedPanelId !== null && !isMaximized;
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
                // A covered panel later in the tree lies over the maximized
                // one, and its empty box would take the presses meant for it.
                pointerEvents={isCovered ? 'none' : undefined}
                testID={`${testID}-panel-${id}`}
                data-selected={isSplit && isActive ? 'true' : undefined}
                data-maximized={isMaximized ? 'true' : undefined}
              >
                <div
                  // Hidden, a covered chart is not painted and takes no
                  // pointer, hover or focus.
                  style={{
                    display: 'contents',
                    visibility: isCovered ? 'hidden' : undefined,
                  }}
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
                  {source ? (
                    <Panel
                      controlsSlot={
                        controlsSlots[index][isActive ? 'active' : 'inactive']
                      }
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
                      onIntervalReport={handleIntervalReport}
                      onLayoutChange={onLayoutChange}
                      onSelectSource={handleSelectPanel}
                      renderPanel={renderPanel}
                    />
                  ) : null}
                </div>
                {/* A maximized panel is the only chart on screen. */}
                {isSplit && isActive && !isMaximized ? (
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
                    // The brand green; the theme has no border token for it.
                    borderColor="$bgAccent"
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
    </Stack>
  );
}
