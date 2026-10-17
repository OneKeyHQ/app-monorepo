import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Stack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LazyPopover } from '@onekeyhq/components/src/actions/LazyPopover';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import { WebPagerContent } from '@onekeyhq/kit/src/components/WebCollapsiblePager';
import { useWebPagerPage } from '@onekeyhq/kit/src/components/WebCollapsiblePagerContext';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildMarketNativeRowPatches } from './marketNativeListRows';

import type { IMarketNativeListPresentation } from './marketNativeListRows';
import type {
  MarketRow,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';
import type { LayoutChangeEvent } from 'react-native';

type ICompactHelp = {
  anchor: NativeListActionAnchor;
  text: string;
  community: boolean;
};

function WebCompactEndObserver({
  height: contentHeight,
  active,
  progressKey,
  paddingTop,
  onEndReached,
}: {
  height: number;
  active: boolean;
  progressKey: string;
  paddingTop: number;
  onEndReached?: () => boolean | void;
}) {
  const { scrollTop, height } = useWebPagerPage();
  const previousScrollTop = useRef(scrollTop);
  const attemptedShortPage = useRef<string | undefined>(undefined);
  useEffect(() => {
    const changed = previousScrollTop.current !== scrollTop;
    previousScrollTop.current = scrollTop;
    const shortPage =
      height >= contentHeight && attemptedShortPage.current !== progressKey;
    if (
      active &&
      onEndReached &&
      contentHeight > 0 &&
      (changed || shortPage) &&
      (Math.max(0, scrollTop - paddingTop) + height) / contentHeight >= 0.8
    ) {
      if (onEndReached() !== false) attemptedShortPage.current = progressKey;
    }
  }, [
    scrollTop,
    height,
    contentHeight,
    active,
    onEndReached,
    progressKey,
    paddingTop,
  ]);
  return null;
}

export function WebMarketCompactList<T>({
  data,
  buildRow,
  onPress,
  onPressIn,
  onLongPress,
  onScrollBegin,
  onEndReached,
  empty,
  footer,
  contentPaddingTop = 4,
  contentPaddingBottom = 0,
  testID,
}: {
  data: readonly T[];
  buildRow: (params: {
    item: T;
    presentation: IMarketNativeListPresentation;
  }) => MarketRow;
  onPress: (item: T) => void;
  onPressIn?: (item: T) => void;
  onLongPress?: (
    item: T,
    index: number,
    point: { x: number; y: number },
  ) => void;
  onScrollBegin?: () => void;
  onEndReached?: () => boolean | void;
  empty?: ReactNode;
  footer?: ReactNode;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
  testID?: string;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const { owner: scrollElement, isFocused: isFocusedTab } = useWebPagerPage();
  const presentation = useMemo<IMarketNativeListPresentation>(
    () => ({
      webImageSources: true,
      theme: {
        background: theme.bgApp.val,
        rowBackground: theme.bgApp.val,
        rowSelectedBackground: theme.bgActive.val,
        rowPressedBackground: theme.bgApp.val,
        subduedBackground: theme.bgSubdued.val,
        strongBackground: theme.bgStrong.val,
        imageFallbackBackground: theme.gray5.val,
        primaryText: theme.text.val,
        secondaryText: theme.textSubdued.val,
        disabledText: theme.textDisabled.val,
        icon: theme.icon.val,
        iconSubdued: theme.iconSubdued.val,
        separator: theme.borderSubdued.val,
        accent: theme.iconActive.val,
        positive: theme.textSuccess.val,
        negative: theme.textCritical.val,
        criticalBackground: theme.bgCritical.val,
        inverseBackground: theme.bgInverse.val,
        inverseText: theme.textInverse.val,
        info: theme.textInfo.val,
        caution: theme.textCaution.val,
      },
      communityRecognizedAccessibilityLabel: intl.formatMessage({
        id: ETranslations.dexmarket_communityRecognized,
      }),
      leverageAccessibilityLabel: intl.formatMessage({
        id: ETranslations.perp_leverage,
      }),
      providerAccessibilityLabel: intl.formatMessage({
        id: ETranslations.swap_history_detail_provider,
      }),
      positiveBackground: theme.bgSuccessStrong.val,
      negativeBackground: theme.bgCriticalStrong.val,
      neutralBackground: theme.neutral9.val,
      infoBackground: theme.bgInfo.val,
      infoText: theme.textInfo.val,
      tokenBackground:
        themeVariant === 'dark' ? theme.neutral6.val : theme.bgApp.val,
      tokenBorderColor:
        themeVariant === 'dark' ? theme.neutral2.val : undefined,
    }),
    [theme, themeVariant, intl],
  );
  const rows = useMemo(
    () =>
      data.map((item) => {
        const row = buildRow({ item, presentation });
        return row.subtitlePrefix?.maxWidth !== undefined
          ? {
              ...row,
              subtitlePrefix: {
                ...row.subtitlePrefix,
                hoverActionKey: 'subtitle-name',
              },
            }
          : row;
      }),
    [data, buildRow, presentation],
  );
  const rowKeys = JSON.stringify(rows.map((row) => row.key));
  const [structure, setStructure] = useState({ keys: rowKeys, generation: 1 });
  if (structure.keys !== rowKeys) {
    setStructure({ keys: rowKeys, generation: structure.generation + 1 });
  }
  const generation = structure.generation;
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation,
      layout: { kind: 'linear', contentPaddingTop, contentPaddingBottom },
      theme: presentation.theme,
      rows,
    }),
    [
      rows,
      presentation.theme,
      generation,
      contentPaddingTop,
      contentPaddingBottom,
    ],
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef({ rows, data, onPressIn });
  useEffect(() => {
    hoverRef.current = { rows, data, onPressIn };
  }, [rows, data, onPressIn]);
  const setRootRef = useCallback((node: unknown) => {
    rootRef.current =
      typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
        ? node
        : null;
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const hover = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>(
        '[data-native-list-row-key]',
      );
      if (
        !element ||
        (event.relatedTarget instanceof Node &&
          element.contains(event.relatedTarget))
      )
        return;
      const latest = hoverRef.current;
      const index = latest.rows.findIndex(
        (row) => row.key === element.dataset.nativeListRowKey,
      );
      const item = latest.data[index];
      if (item !== undefined) latest.onPressIn?.(item);
    };
    root.addEventListener('pointerover', hover);
    return () => root.removeEventListener('pointerover', hover);
  }, []);
  const [footerHeight, setFooterHeight] = useState(76);
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setFooterHeight((previous) => (previous === next ? previous : next));
  }, []);
  const footerNode = useMemo(
    () =>
      footer ? <Stack onLayout={handleFooterLayout}>{footer}</Stack> : null,
    [footer, handleFooterLayout],
  );
  const virtualHeight = useMemo(
    () =>
      rows.reduce((total, row) => total + (row.height ?? 72), 0) +
      (footer ? footerHeight : 0),
    [rows, footer, footerHeight],
  );
  const listRef = useRef<NativeListRef>(null);
  const [baseSnapshot, setBaseSnapshot] = useState(snapshot);
  const appliedRef = useRef<
    { base: NativeListSnapshot; latest: NativeListSnapshot } | undefined
  >(undefined);
  const previous =
    appliedRef.current?.base === baseSnapshot
      ? appliedRef.current.latest
      : baseSnapshot;
  const patches = useMemo(
    () => buildMarketNativeRowPatches(previous, snapshot),
    [previous, snapshot],
  );
  if (patches === undefined && baseSnapshot !== snapshot)
    setBaseSnapshot(snapshot);
  useEffect(() => {
    if (!listRef.current) {
      appliedRef.current = undefined;
      return;
    }
    if (patches?.length) listRef.current.applyPatches(patches);
    appliedRef.current = { base: baseSnapshot, latest: snapshot };
  }, [patches, snapshot, baseSnapshot]);
  const [help, setHelp] = useState<ICompactHelp>();
  const handleAction = useCallback(
    (event: RowActionEvent) => {
      const index = rows.findIndex((row) => row.key === event.rowKey);
      const row = rows[index];
      const item = data[index];
      if (!row || item === undefined) return;
      if (
        event.actionKey === row.pressActionKey ||
        event.actionKey === 'press'
      ) {
        onPress(item);
        return;
      }
      if (event.actionKey === row.longPressActionKey && event.anchor) {
        listRef.current?.setActionAnchorState({
          token: event.anchor.token,
          open: true,
        });
        onLongPress?.(item, index, {
          x: window.innerWidth * 0.48,
          y:
            (event.windowPoint?.y ??
              event.anchor.windowRect.y + event.anchor.windowRect.height / 2) -
            4,
        });
        return;
      }
      if (event.actionKey === row.pressInActionKey) {
        onPressIn?.(item);
        return;
      }
      if (!event.anchor) return;
      const badge =
        event.anchor.source === 'marketBadge' && event.anchor.slot !== undefined
          ? row.badges?.[event.anchor.slot]
          : undefined;
      let text =
        event.actionKey === row.subtitlePrefix?.hoverActionKey
          ? row.subtitlePrefix.text
          : badge?.accessibilityLabel;
      const community = badge?.iconName === 'verified';
      if (community)
        text = intl.formatMessage({
          id: ETranslations.dexmarket_communityRecognized,
        });
      if (event.actionKey === 'perps-dex-info') {
        const dex = badge?.text?.toLowerCase();
        if (dex === 'xyz')
          text = intl.formatMessage({
            id: ETranslations.perp_xyz_market__desc,
          });
        else if (dex === 'para')
          text = intl.formatMessage({
            id: ETranslations.perp_para_market__desc,
          });
        else if (dex === 'io')
          text = intl.formatMessage({ id: ETranslations.perp_io_market__desc });
      }
      if (!text) return;
      listRef.current?.setActionAnchorState({
        token: event.anchor.token,
        open: true,
      });
      setHelp({ anchor: event.anchor, text, community });
    },
    [rows, data, onPress, onPressIn, onLongPress, intl],
  );
  const closeHelp = useCallback(() => {
    if (help)
      listRef.current?.setActionAnchorState({
        token: help.anchor.token,
        open: false,
        restoreFocus: true,
      });
    setHelp(undefined);
  }, [help]);
  return (
    <WebPagerContent style={{ flex: 0 }}>
      <Stack
        ref={setRootRef}
        testID={testID}
        width="100%"
        paddingBottom={
          rows.length ? contentPaddingTop + contentPaddingBottom : 0
        }
      >
        <NativeList
          ref={listRef}
          snapshot={baseSnapshot}
          webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
          listEmpty={empty}
          listFooter={footerNode}
          onRowAction={handleAction}
          onActionAnchorInvalidated={(event) => {
            setHelp(undefined);
            if (event.reason !== 'pointerLeave') onScrollBegin?.();
          }}
          style={{ width: '100%' }}
        />
        <WebCompactEndObserver
          height={virtualHeight}
          active={isFocusedTab}
          progressKey={rowKeys}
          paddingTop={contentPaddingTop}
          onEndReached={onEndReached}
        />
        {help ? (
          <Stack
            position="fixed"
            left={help.anchor.windowRect.x}
            top={help.anchor.windowRect.y}
            width={help.anchor.windowRect.width}
            height={help.anchor.windowRect.height}
            pointerEvents="none"
          >
            {help.community ? (
              <LazyPopover
                open
                onOpenChange={(open) => {
                  if (!open) closeHelp();
                }}
                title={
                  <Icon
                    name="BadgeRecognizedSolid"
                    size="$8"
                    color="$iconSuccess"
                  />
                }
                placement="top"
                renderTrigger={
                  <Stack
                    width={help.anchor.windowRect.width}
                    height={help.anchor.windowRect.height}
                    pointerEvents="none"
                  />
                }
                renderContent={
                  <YStack px="$5" py="$4">
                    <SizableText size="$bodyLg">{help.text}</SizableText>
                  </YStack>
                }
              />
            ) : (
              <LazyTooltip
                open
                onOpenChange={(open) => {
                  if (!open) closeHelp();
                }}
                placement="top"
                renderTrigger={
                  <Stack
                    width={help.anchor.windowRect.width}
                    height={help.anchor.windowRect.height}
                    pointerEvents="none"
                  />
                }
                renderContent={
                  <SizableText size="$bodySm">{help.text}</SizableText>
                }
              />
            )}
          </Stack>
        ) : null}
      </Stack>
    </WebPagerContent>
  );
}
