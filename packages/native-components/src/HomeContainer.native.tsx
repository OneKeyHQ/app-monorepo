import {
  type ComponentType,
  Profiler,
  type ProfilerOnRenderCallback,
  type PropsWithChildren,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  NitroModules,
  getHostComponent,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import HomeContainerConfig from '../nitrogen/generated/shared/json/HomeContainerConfig.json';

import {
  type IHomeContainerCapabilities,
  type IHomeContainerProps,
  type IHomeContainerRef,
  type IHomeContainerSlot,
  serializeHomeContainerPayload,
} from './HomeContainer.types';
import { resolveHomeContainerBackgroundColor } from './HomeContainerBackground';
import HomeContainerSlotNativeComponent from './HomeContainerSlotNativeComponent';
import { resolveHomeContainerSlots } from './HomeContainerSlotPresentation';
import HomeContainerSurfaceNativeComponent from './HomeContainerSurfaceNativeComponent';

import type {
  HomeContainer as HomeContainerNativeView,
  IHomeContainerNativeMethods,
  IHomeContainerNativeProps,
} from './HomeContainer.nitro';
import type { NativeProps as IHomeContainerSlotNativeProps } from './HomeContainerSlotNativeComponent';
import type { NativeProps as IHomeContainerSurfaceNativeProps } from './HomeContainerSurfaceNativeComponent';

const HomeContainerSurface =
  HomeContainerSurfaceNativeComponent as unknown as ComponentType<
    PropsWithChildren<IHomeContainerSurfaceNativeProps>
  >;
const HomeContainerSlot =
  HomeContainerSlotNativeComponent as unknown as ComponentType<
    PropsWithChildren<IHomeContainerSlotNativeProps>
  >;
const HOME_HEADER_HORIZONTAL_INSET = 20;

const styles = StyleSheet.create({
  engine: {
    ...StyleSheet.absoluteFillObject,
  },
  slot: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  accountRowSlot: {
    height: 32,
  },
  balanceSlot: {
    height: 58,
  },
  headerActionRowSlot: {
    height: 62,
  },
  tabAccessorySlot: {
    width: 36,
    height: 36,
  },
  portfolioContentHeaderSlot: {
    width: '100%',
    height: 56,
  },
  perpsContentHeaderSlot: {
    width: '100%',
    height: 88,
  },
  defiContentHeaderSlot: {
    width: '100%',
    height: 56,
  },
  contentStateSlot: {
    width: '100%',
    height: 320,
  },
  footerUpgradeSlot: {
    width: '100%',
    height: 152,
  },
  footerSupportSlot: {
    width: '100%',
    height: 371,
  },
  footerHistoryEndSlot: {
    width: '100%',
    height: 136,
  },
  slotContent: {
    flex: 1,
  },
});

function parseCapabilities(
  value: string | undefined,
): IHomeContainerCapabilities | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as IHomeContainerCapabilities;
  } catch {
    return undefined;
  }
}

function getSlotLayoutStyle(key: string) {
  if (key === 'header.account-row') {
    return styles.accountRowSlot;
  }
  if (key === 'header.balance') {
    return styles.balanceSlot;
  }
  if (key === 'header.action-row') {
    return styles.headerActionRowSlot;
  }
  if (key === 'content.header.portfolio') {
    return styles.portfolioContentHeaderSlot;
  }
  if (key === 'content.header.perps') {
    return styles.perpsContentHeaderSlot;
  }
  if (key === 'content.header.defi') {
    return styles.defiContentHeaderSlot;
  }
  if (key.startsWith('content.state.')) {
    return styles.contentStateSlot;
  }
  if (key.endsWith('.upgrade') && key.startsWith('content.footer.')) {
    return styles.footerUpgradeSlot;
  }
  if (key.endsWith('.support') && key.startsWith('content.footer.')) {
    return styles.footerSupportSlot;
  }
  if (key.endsWith('.historyEnd') && key.startsWith('content.footer.')) {
    return styles.footerHistoryEndSlot;
  }
  if (key.startsWith('tab.accessory.')) {
    return styles.tabAccessorySlot;
  }
  return undefined;
}

function getSlotWidthStyle(key: string, windowWidth: number) {
  if (
    key === 'header.account-row' ||
    key === 'header.balance' ||
    key === 'header.action-row'
  ) {
    return {
      width: Math.max(0, windowWidth - HOME_HEADER_HORIZONTAL_INSET * 2),
    };
  }
  return undefined;
}

function createHomeContainerHost() {
  return getHostComponent<
    IHomeContainerNativeProps,
    IHomeContainerNativeMethods
  >('HomeContainer', () => HomeContainerConfig);
}

type IHomeContainerHost = ReturnType<typeof createHomeContainerHost>;

function getHomeContainerHost(): IHomeContainerHost {
  const runtime = globalThis as typeof globalThis & {
    __onekeyHomeContainerHost?: IHomeContainerHost;
  };
  runtime.__onekeyHomeContainerHost ??= createHomeContainerHost();
  return runtime.__onekeyHomeContainerHost;
}

const HomeContainerHost = getHomeContainerHost();

export function isHomeContainerAvailable(): boolean {
  return NitroModules.hasHybridObject('HomeContainer');
}

type IHomeContainerSlotViewProps = {
  backgroundColor: string;
  interactionEnabled: boolean;
  onProfilerRender: ProfilerOnRenderCallback;
  slot: IHomeContainerSlot;
  slotKey: string;
  windowWidth: number;
};

type IHomeContainerSlotContentViewProps = {
  content: IHomeContainerSlot['content'];
  contentRevision: IHomeContainerSlot['contentRevision'];
  interactive: boolean;
  onProfilerRender: ProfilerOnRenderCallback;
  slotKey: string;
};

const HomeContainerSlotContentView = memo(
  function HomeContainerSlotContentView({
    content,
    interactive,
    onProfilerRender,
    slotKey,
  }: IHomeContainerSlotContentViewProps) {
    return (
      <Profiler id={`slot.${slotKey}`} onRender={onProfilerRender}>
        <View
          collapsable={false}
          pointerEvents={interactive ? 'auto' : 'none'}
          style={styles.slotContent}
        >
          {content}
        </View>
      </Profiler>
    );
  },
  (previous, next) =>
    previous.contentRevision === next.contentRevision &&
    previous.interactive === next.interactive &&
    previous.onProfilerRender === next.onProfilerRender &&
    previous.slotKey === next.slotKey,
);

const HomeContainerSlotView = memo(function HomeContainerSlotView({
  backgroundColor,
  interactionEnabled,
  onProfilerRender,
  slot,
  slotKey,
  windowWidth,
}: IHomeContainerSlotViewProps) {
  const interactive = interactionEnabled && slot.interaction === 'tap';
  const authority =
    slot.authority?.slotId === slotKey ? slot.authority : undefined;
  return (
    <HomeContainerSlot
      ownerScopeKey={authority?.owner.scopeKey ?? ''}
      ownerSessionId={authority?.owner.sessionId ?? ''}
      producedByStoreCommitId={authority?.producedByStoreCommitId ?? -1}
      slotKey={slotKey}
      slotRevision={authority?.slotRevision ?? -1}
      testID={`HomeContainer.Slot.${slotKey}`}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[
        styles.slot,
        getSlotLayoutStyle(slotKey),
        getSlotWidthStyle(slotKey, windowWidth),
        slot.height === undefined ? undefined : { height: slot.height },
        { backgroundColor },
      ]}
    >
      <HomeContainerSlotContentView
        content={slot.content}
        contentRevision={slot.contentRevision}
        interactive={interactive}
        onProfilerRender={onProfilerRender}
        slotKey={slotKey}
      />
    </HomeContainerSlot>
  );
});

const NativeHomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (
    {
      initialSnapshot,
      slots,
      slotBundle,
      style,
      testID,
      debugOverlayEnabled = false,
      onReady,
      onAction,
      onRefresh,
      onVisibleTabChange,
      onRenderError,
      onIntent,
      onProfilerRender,
    },
    ref,
  ) => {
    const { width: windowWidth } = useWindowDimensions();
    const nativeRef = useRef<HomeContainerNativeView | null>(null);
    const initialSnapshotRef = useRef(initialSnapshot);
    const initialSnapshotJsonRef = useRef(
      initialSnapshot ? serializeHomeContainerPayload(initialSnapshot) : '',
    );

    useImperativeHandle(
      ref,
      () => ({
        setSnapshot: (nextSnapshot) => {
          nativeRef.current?.setSnapshot(
            serializeHomeContainerPayload(nextSnapshot),
          );
        },
        setDomains: (batch) => {
          nativeRef.current?.setDomains(serializeHomeContainerPayload(batch));
        },
        completeRefresh: (requestId) => {
          nativeRef.current?.completeRefresh(requestId);
        },
        selectTab: (tabId, animated = true) => {
          nativeRef.current?.selectTab(tabId, animated);
        },
        getCapabilities: () => {
          return parseCapabilities(nativeRef.current?.getCapabilities());
        },
      }),
      [],
    );

    const onActionRef = useRef(onAction);
    onActionRef.current = onAction;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;
    const onVisibleTabChangeRef = useRef(onVisibleTabChange);
    onVisibleTabChangeRef.current = onVisibleTabChange;
    const onRenderErrorRef = useRef(onRenderError);
    onRenderErrorRef.current = onRenderError;
    const onIntentRef = useRef(onIntent);
    onIntentRef.current = onIntent;
    const onProfilerRenderRef = useRef(onProfilerRender);
    onProfilerRenderRef.current = onProfilerRender;

    const stableOnAction = useCallback(
      (actionId: string, itemId: string, tabId: string) => {
        onActionRef.current?.(actionId, itemId, tabId);
      },
      [],
    );
    const stableOnRefresh = useCallback((tabId: string, requestId: string) => {
      onRefreshRef.current?.(tabId, requestId);
    }, []);
    const stableOnVisibleTabChange = useCallback((tabId: string) => {
      onVisibleTabChangeRef.current?.(tabId);
    }, []);
    const stableOnRenderError = useCallback((code: string, message: string) => {
      onRenderErrorRef.current?.(code, message);
    }, []);
    const stableOnIntent = useCallback((intentJson: string) => {
      onIntentRef.current?.(intentJson);
    }, []);
    const stableOnProfilerRender = useCallback<ProfilerOnRenderCallback>(
      (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        onProfilerRenderRef.current?.(
          id,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        );
      },
      [],
    );

    const hasOnAction = Boolean(onAction);
    const hasOnRefresh = Boolean(onRefresh);
    const hasOnVisibleTabChange = Boolean(onVisibleTabChange);
    const hasOnRenderError = Boolean(onRenderError);
    const hasOnIntent = Boolean(onIntent);
    const onActionCallback = useMemo(
      () => (hasOnAction ? nitroCallback(stableOnAction) : undefined),
      [hasOnAction, stableOnAction],
    );
    const onRefreshCallback = useMemo(
      () => (hasOnRefresh ? nitroCallback(stableOnRefresh) : undefined),
      [hasOnRefresh, stableOnRefresh],
    );
    const onVisibleTabChangeCallback = useMemo(
      () =>
        hasOnVisibleTabChange
          ? nitroCallback(stableOnVisibleTabChange)
          : undefined,
      [hasOnVisibleTabChange, stableOnVisibleTabChange],
    );
    const onRenderErrorCallback = useMemo(
      () => (hasOnRenderError ? nitroCallback(stableOnRenderError) : undefined),
      [hasOnRenderError, stableOnRenderError],
    );
    const onIntentCallback = useMemo(
      () => (hasOnIntent ? nitroCallback(stableOnIntent) : undefined),
      [hasOnIntent, stableOnIntent],
    );
    const stableHybridRef = useCallback((nextRef: HomeContainerNativeView) => {
      nativeRef.current = nextRef;
      const capabilities = parseCapabilities(nextRef.getCapabilities());
      if (capabilities) {
        // Nitro publishes the hybrid ref during the native commit, before
        // React publishes this wrapper's imperative ref to its parent.
        // Defer readiness until both sides of the ref bridge are committed.
        void Promise.resolve().then(() => {
          if (nativeRef.current === nextRef) {
            onReadyRef.current?.(capabilities);
          }
        });
      }
    }, []);
    const hybridRefCallback = useMemo(
      () => nitroCallback(stableHybridRef),
      [stableHybridRef],
    );
    const resolvedBackgroundColor = resolveHomeContainerBackgroundColor({
      snapshotBackgroundColor:
        initialSnapshotRef.current?.payload.theme.backgroundColor,
      slotBackgroundColor:
        slotBundle?.slots.backgroundColor ?? slots?.backgroundColor,
    });

    const resolvedSlots = useMemo(
      () =>
        resolveHomeContainerSlots({
          currentBundle: slotBundle,
          legacySlots: slots,
        }),
      [slotBundle, slots],
    );

    const slotViews = useMemo(() => {
      if (!resolvedSlots) {
        return null;
      }
      // Preserve slot ownership and geometry until the target owner publishes.
      // Unmounting the keys exposes native fallbacks with different typography.
      const interactionEnabled = slotBundle?.phase !== 'owner-transition';
      const values: Array<{ key: string; slot: IHomeContainerSlot }> = [];
      if (resolvedSlots.accountRow) {
        values.push({
          key: 'header.account-row',
          slot: resolvedSlots.accountRow,
        });
      }
      if (resolvedSlots.balance) {
        values.push({ key: 'header.balance', slot: resolvedSlots.balance });
      }
      if (resolvedSlots.headerActionRow) {
        values.push({
          key: 'header.action-row',
          slot: resolvedSlots.headerActionRow,
        });
      }
      Object.entries(resolvedSlots.contentHeaders ?? {}).forEach(
        ([tabId, slot]) => {
          if (slot) {
            values.push({ key: `content.header.${tabId}`, slot });
          }
        },
      );
      Object.entries(resolvedSlots.contentStates ?? {}).forEach(
        ([tabId, slot]) => {
          if (slot) {
            values.push({ key: `content.state.${tabId}`, slot });
          }
        },
      );
      Object.entries(resolvedSlots.contentFooters ?? {}).forEach(
        ([tabId, footerSlots]) => {
          Object.entries(footerSlots ?? {}).forEach(([footerId, slot]) => {
            if (slot) {
              values.push({
                key: `content.footer.${tabId}.${footerId}`,
                slot,
              });
            }
          });
        },
      );
      Object.entries(resolvedSlots.tabAccessories ?? {}).forEach(
        ([tabId, slot]) => {
          if (slot) {
            values.push({ key: `tab.accessory.${tabId}`, slot });
          }
        },
      );
      return values.map(({ key, slot }) => {
        return (
          <HomeContainerSlotView
            key={key}
            backgroundColor={resolvedBackgroundColor}
            interactionEnabled={interactionEnabled}
            onProfilerRender={stableOnProfilerRender}
            slot={slot}
            slotKey={key}
            windowWidth={windowWidth}
          />
        );
      });
    }, [
      resolvedBackgroundColor,
      resolvedSlots,
      slotBundle?.phase,
      stableOnProfilerRender,
      windowWidth,
    ]);

    return (
      <HomeContainerSurface
        pointerEvents={
          slotBundle?.phase === 'owner-transition' ? 'none' : 'auto'
        }
        style={style}
        testID={testID}
      >
        <Profiler id="nativeHost" onRender={stableOnProfilerRender}>
          <HomeContainerHost
            initialSnapshotJson={initialSnapshotJsonRef.current}
            backgroundColor={resolvedBackgroundColor}
            debugOverlayEnabled={debugOverlayEnabled}
            style={styles.engine}
            onAction={onActionCallback}
            onRefresh={onRefreshCallback}
            onVisibleTabChange={onVisibleTabChangeCallback}
            onRenderError={onRenderErrorCallback}
            onIntent={onIntentCallback}
            hybridRef={hybridRefCallback}
          />
        </Profiler>
        {slotViews}
      </HomeContainerSurface>
    );
  },
);

NativeHomeContainer.displayName = 'NativeHomeContainer';

export const HomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (props, ref) => <NativeHomeContainer {...props} ref={ref} />,
);

HomeContainer.displayName = 'HomeContainer';
