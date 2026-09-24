import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentType, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import {
  useMarketTradingViewChartSettingsPersistAtom,
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useMarketTradingViewLayoutPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTradingViewPanelSizes } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  closeTradingViewPanel,
  getTradingViewPanelSizes,
  moveTradingViewPanel,
  normalizeTradingViewMultiChartLayout,
  resizeTradingViewMultiChartLayout,
  resizeTradingViewPanelSizes,
} from './multiChartLayout';
import { TradingViewLayoutSelector } from './TradingViewLayoutSelector';
import { TradingViewNativePresentation } from './TradingViewNativePresentation';
import { TradingViewPanelButton } from './TradingViewPanelButton';
import { TradingViewPanelDivider } from './TradingViewPanelDivider';

import type { ITradingViewNativeProps } from './types';
import type { LayoutChangeEvent } from 'react-native';

// Keep data and viewport owners mounted when native fullscreen moves the grid into its window layer.
const PanelController = memo(function PanelController({
  id,
  onContentChange,
  ChartComponent,
  ...chartProps
}: ITradingViewNativeProps & {
  id: string;
  ChartComponent: ComponentType<ITradingViewNativeProps>;
  onContentChange: (id: string, content: ReactNode) => void;
}) {
  const handleContentChange = useCallback(
    (content: ReactNode) => onContentChange(id, content),
    [id, onContentChange],
  );
  useLayoutEffect(() => () => onContentChange(id, null), [id, onContentChange]);
  return (
    <ChartComponent
      {...chartProps}
      onPresentationContentChange={handleContentChange}
    />
  );
});

export function TradingViewNativeMultiChart({
  ChartComponent,
  ...props
}: ITradingViewNativeProps & {
  ChartComponent: ComponentType<ITradingViewNativeProps>;
}) {
  const intl = useIntl();
  const [storedLayout, setLayout] = useMarketTradingViewLayoutPersistAtom();
  const [chartSettings] = useMarketTradingViewChartSettingsPersistAtom();
  const [indicatorSettings] =
    useMarketTradingViewIndicatorSettingsPersistAtom();
  const layout = useMemo(
    () => normalizeTradingViewMultiChartLayout(storedLayout),
    [storedLayout],
  );
  const [width, setWidth] = useState(0);
  const [contents, setContents] = useState<Record<string, ReactNode>>({});
  const handleContentChange = useCallback((id: string, content: ReactNode) => {
    setContents((current) => {
      if (current[id] === content) return current;
      if (content === null) {
        const remaining = { ...current };
        delete remaining[id];
        return remaining;
      }
      return { ...current, [id]: content };
    });
  }, []);
  const { panelCount } = layout;
  const isMultiple = panelCount > 1;
  const columns = isMultiple && width >= 600 ? 2 : 1;
  const rows = Math.ceil(panelCount / columns);
  const panelIds = layout.panelOrder.slice(0, panelCount);
  const sizeKey = `${panelCount}:${columns}`;
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [draftSizes, setDraftSizes] = useState<{
    key: string;
    sizes: IMarketTradingViewPanelSizes;
  } | null>(null);
  const sizes =
    draftSizes?.key === sizeKey
      ? draftSizes.sizes
      : getTradingViewPanelSizes(
          layout.panelSizes?.[sizeKey],
          columns,
          rows,
          gridSize,
        );
  const resizeSnapshotRef = useRef({ sizeKey, sizes, gridSize });
  const activeResizeRef = useRef<{
    axis: 'columns' | 'rows';
    index: number;
    snapshot: typeof resizeSnapshotRef.current;
    sizes: IMarketTradingViewPanelSizes;
  } | null>(null);
  useLayoutEffect(() => {
    resizeSnapshotRef.current = { sizeKey, sizes, gridSize };
  }, [gridSize, sizeKey, sizes]);
  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setGridSize((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight },
    );
  }, []);
  const {
    isNativeChartFullscreen,
    nativeChartFullscreenHeader,
    onNativeChartFullscreenChange,
    onNativeMultiChartCountChange,
    onNativeMultiChartResizingChange,
  } = props;
  const handleResizeStart = useCallback(
    (axis: 'columns' | 'rows', index: number) => {
      const snapshot = resizeSnapshotRef.current;
      activeResizeRef.current = {
        axis,
        index,
        snapshot,
        sizes: snapshot.sizes,
      };
      onNativeMultiChartResizingChange?.(true);
    },
    [onNativeMultiChartResizingChange],
  );
  const handleResizeMove = useCallback((delta: number) => {
    const active = activeResizeRef.current;
    if (!active) return;
    const { axis, index, snapshot } = active;
    active.sizes = {
      ...snapshot.sizes,
      [axis]: resizeTradingViewPanelSizes({
        sizes: snapshot.sizes[axis],
        dividerIndex: index,
        delta,
        availableSize:
          axis === 'columns'
            ? snapshot.gridSize.width
            : snapshot.gridSize.height,
        minimumSize: axis === 'columns' ? 180 : 140,
      }),
    };
    setDraftSizes({ key: snapshot.sizeKey, sizes: active.sizes });
  }, []);
  const handleResizeEnd = useCallback(
    (commit: boolean) => {
      const active = activeResizeRef.current;
      activeResizeRef.current = null;
      if (active && commit) {
        void setLayout((current) => ({
          ...current,
          panelSizes: {
            ...current.panelSizes,
            [active.snapshot.sizeKey]: active.sizes,
          },
        }));
      }
      setDraftSizes(null);
      onNativeMultiChartResizingChange?.(false);
    },
    [onNativeMultiChartResizingChange, setLayout],
  );
  useEffect(
    () => () => onNativeMultiChartResizingChange?.(false),
    [onNativeMultiChartResizingChange],
  );
  useEffect(() => {
    onNativeMultiChartCountChange?.(panelCount);
  }, [onNativeMultiChartCountChange, panelCount]);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const layoutTitle = intl.formatMessage({
    id: ETranslations.perps_layout_settings__title,
  });
  let layoutIcon: 'single' | 'columns' | 'rows' | 'grid' = 'grid';
  if (panelCount === 1) {
    layoutIcon = 'single';
  } else if (panelCount === 2) {
    layoutIcon = columns === 2 ? 'columns' : 'rows';
  }
  const handleLayoutChange = useCallback(
    (value: number) => {
      if (value !== 1 && value !== 2 && value !== 4) {
        return;
      }
      void setLayout((current) =>
        resizeTradingViewMultiChartLayout(current, value, {
          chartSettings,
          indicatorSettings,
        }),
      );
    },
    [chartSettings, indicatorSettings, setLayout],
  );
  const fullscreenTitle = intl.formatMessage({
    id: isNativeChartFullscreen
      ? ETranslations.global_collapse
      : ETranslations.global_expand,
  });
  const workspaceControls = useMemo(
    () => (
      <XStack
        alignItems="center"
        flexShrink={0}
        gap="$1"
        testID="trading-view-multi-chart-toolbar"
      >
        <TradingViewLayoutSelector
          title={layoutTitle}
          panelCount={panelCount}
          icon={layoutIcon}
          onChange={handleLayoutChange}
        />
        {onNativeChartFullscreenChange ? (
          <TradingViewPanelButton
            icon={isNativeChartFullscreen ? 'exitFullscreen' : 'fullscreen'}
            accessibilityLabel={fullscreenTitle}
            testID="trading-view-multi-chart-fullscreen"
            onPress={() =>
              onNativeChartFullscreenChange(!isNativeChartFullscreen)
            }
          />
        ) : null}
      </XStack>
    ),
    [
      fullscreenTitle,
      handleLayoutChange,
      isNativeChartFullscreen,
      layoutIcon,
      layoutTitle,
      onNativeChartFullscreenChange,
      panelCount,
    ],
  );

  return (
    <>
      {panelIds.map((id, index) => (
        <PanelController
          key={id}
          id={id}
          ChartComponent={ChartComponent}
          onContentChange={handleContentChange}
          {...props}
          enableMultiChart={false}
          panelId={id === 'main' ? undefined : id}
          testID={
            id === 'main' ? props.testID : `${props.testID ?? 'chart'}-${id}`
          }
          isPresentationManaged
          isNativeChartFullscreen={isNativeChartFullscreen}
          nativeChartFullscreenHeader={undefined}
          nativeChartWorkspaceControls={
            index === 0 ? workspaceControls : undefined
          }
          onNativeMultiChartCountChange={undefined}
          onNativeMultiChartResizingChange={undefined}
          nativeControlsLayoutMode={
            isMultiple ? 'mobile' : props.nativeControlsLayoutMode
          }
          nativeChartSettingsInToolbar={
            isMultiple ? false : props.nativeChartSettingsInToolbar
          }
          showNativeIndicatorQuickBar={
            isMultiple ? false : props.showNativeIndicatorQuickBar
          }
          onNativeIndicatorQuickBarChange={
            index === 0 ? props.onNativeIndicatorQuickBarChange : undefined
          }
          onPriceUpdate={index === 0 ? props.onPriceUpdate : undefined}
          onDataStateChange={index === 0 ? props.onDataStateChange : undefined}
          onNativeSubIndicatorCountChange={
            index === 0 ? props.onNativeSubIndicatorCountChange : undefined
          }
        />
      ))}
      <TradingViewNativePresentation
        isFullscreen={Boolean(isNativeChartFullscreen)}
      >
        <Stack flex={1} minHeight={0} width="100%" onLayout={handleLayout}>
          {isNativeChartFullscreen && nativeChartFullscreenHeader ? (
            <XStack height={32} flexShrink={0} alignItems="center" px="$2">
              {nativeChartFullscreenHeader}
            </XStack>
          ) : null}
          <Stack
            flex={1}
            minHeight={0}
            position="relative"
            onLayout={handleGridLayout}
            testID={`trading-view-chart-layout-${panelCount}`}
          >
            {panelIds.map((id, index) => (
              <Stack
                key={id}
                position="absolute"
                left={`${sizes.columns.slice(0, index % columns).reduce((sum, size) => sum + size, 0) * 100}%`}
                top={`${sizes.rows.slice(0, Math.floor(index / columns)).reduce((sum, size) => sum + size, 0) * 100}%`}
                width={`${sizes.columns[index % columns] * 100}%`}
                height={`${sizes.rows[Math.floor(index / columns)] * 100}%`}
                minHeight={0}
                overflow="hidden"
                borderRightWidth={columns === 2 && index % 2 === 0 ? 1 : 0}
                borderBottomWidth={index < panelCount - columns ? 1 : 0}
                borderColor="$borderSubdued"
                testID={`trading-view-chart-panel-${id}`}
              >
                {isMultiple ? (
                  <XStack
                    height={28}
                    flexShrink={0}
                    alignItems="center"
                    px="$2"
                    bg="$bgSubdued"
                  >
                    <SizableText size="$bodySm" color="$textSubdued" flex={1}>
                      {`${intl.formatMessage({ id: ETranslations.market_chart })} ${id === 'main' ? 1 : id.slice(-1)}`}
                    </SizableText>
                    <TradingViewPanelButton
                      icon="moveLeft"
                      disabled={index === 0}
                      accessibilityLabel={intl.formatMessage({
                        id: ETranslations.global_back,
                      })}
                      testID={`trading-view-chart-panel-${id}-move`}
                      onPress={() => {
                        void setLayout((current) =>
                          moveTradingViewPanel(current, id, -1),
                        );
                      }}
                    />
                    <TradingViewPanelButton
                      icon="close"
                      accessibilityLabel={intl.formatMessage({
                        id: ETranslations.global_close,
                      })}
                      testID={`trading-view-chart-panel-${id}-close`}
                      onPress={() => {
                        void setLayout((current) =>
                          closeTradingViewPanel(current, id),
                        );
                      }}
                    />
                  </XStack>
                ) : null}
                {contents[id]}
              </Stack>
            ))}
            {(['columns', 'rows'] as const).flatMap((axis) =>
              sizes[axis].slice(0, -1).map((_size, index) => (
                <TradingViewPanelDivider
                  key={`${axis}:${index}`}
                  axis={axis}
                  index={index}
                  position={sizes[axis]
                    .slice(0, index + 1)
                    .reduce((sum, size) => sum + size, 0)}
                  label={intl.formatMessage({
                    id: ETranslations.perps_desktop_resize_panels__desc,
                  })}
                  onStart={handleResizeStart}
                  onMove={handleResizeMove}
                  onEnd={handleResizeEnd}
                />
              )),
            )}
          </Stack>
        </Stack>
      </TradingViewNativePresentation>
    </>
  );
}
