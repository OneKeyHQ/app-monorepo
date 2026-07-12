import {
  type ComponentType,
  type PropsWithChildren,
  forwardRef,
  useCallback,
  useEffect,
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
import HomeContainerSlotNativeComponent from './HomeContainerSlotNativeComponent';
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
const HOME_HEADER_HORIZONTAL_INSET = 16;

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
    height: 72,
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

const NativeHomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (
    {
      snapshot,
      slots,
      style,
      testID,
      debugOverlayEnabled = false,
      onReady,
      onAction,
      onRefresh,
      onVisibleTabChange,
      onRenderError,
    },
    ref,
  ) => {
    const { width: windowWidth } = useWindowDimensions();
    const nativeRef = useRef<HomeContainerNativeView | null>(null);
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    const pushSnapshot = useCallback(() => {
      const nextSnapshot = snapshotRef.current;
      if (nextSnapshot) {
        nativeRef.current?.setSnapshot(
          serializeHomeContainerPayload(nextSnapshot),
        );
      }
    }, []);

    useEffect(() => {
      pushSnapshot();
    }, [pushSnapshot, snapshot]);

    useImperativeHandle(
      ref,
      () => ({
        setSnapshot: (nextSnapshot) => {
          nativeRef.current?.setSnapshot(
            serializeHomeContainerPayload(nextSnapshot),
          );
        },
        applyPatch: (patch) => {
          nativeRef.current?.applyPatch(serializeHomeContainerPayload(patch));
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

    const hasOnAction = Boolean(onAction);
    const hasOnRefresh = Boolean(onRefresh);
    const hasOnVisibleTabChange = Boolean(onVisibleTabChange);
    const hasOnRenderError = Boolean(onRenderError);
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
    const stableHybridRef = useCallback(
      (nextRef: HomeContainerNativeView) => {
        nativeRef.current = nextRef;
        pushSnapshot();
        const capabilities = parseCapabilities(nextRef.getCapabilities());
        if (capabilities) {
          onReadyRef.current?.(capabilities);
        }
      },
      [pushSnapshot],
    );
    const hybridRefCallback = useMemo(
      () => nitroCallback(stableHybridRef),
      [stableHybridRef],
    );

    const slotViews = useMemo(() => {
      if (!slots) {
        return null;
      }
      const values: Array<{ key: string; slot: IHomeContainerSlot }> = [];
      if (slots.accountRow) {
        values.push({ key: 'header.account-row', slot: slots.accountRow });
      }
      if (slots.balance) {
        values.push({ key: 'header.balance', slot: slots.balance });
      }
      if (slots.headerActionRow) {
        values.push({
          key: 'header.action-row',
          slot: slots.headerActionRow,
        });
      }
      Object.entries(slots.contentHeaders ?? {}).forEach(([tabId, slot]) => {
        if (slot) {
          values.push({ key: `content.header.${tabId}`, slot });
        }
      });
      Object.entries(slots.contentStates ?? {}).forEach(([tabId, slot]) => {
        if (slot) {
          values.push({ key: `content.state.${tabId}`, slot });
        }
      });
      Object.entries(slots.contentFooters ?? {}).forEach(
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
      Object.entries(slots.tabAccessories ?? {}).forEach(([tabId, slot]) => {
        if (slot) {
          values.push({ key: `tab.accessory.${tabId}`, slot });
        }
      });
      const backgroundColor =
        slots.backgroundColor ??
        snapshot?.theme.backgroundColor ??
        'transparent';
      return values.map(({ key, slot }) => {
        const interactive = slot.interaction === 'tap';
        return (
          <HomeContainerSlot
            key={key}
            slotKey={key}
            testID={`HomeContainer.Slot.${key}`}
            pointerEvents={interactive ? 'auto' : 'none'}
            style={[
              styles.slot,
              getSlotLayoutStyle(key),
              getSlotWidthStyle(key, windowWidth),
              { backgroundColor },
            ]}
          >
            <View
              collapsable={false}
              pointerEvents={interactive ? 'auto' : 'none'}
              style={styles.slotContent}
            >
              {slot.content}
            </View>
          </HomeContainerSlot>
        );
      });
    }, [slots, snapshot?.theme.backgroundColor, windowWidth]);

    return (
      <HomeContainerSurface style={style} testID={testID}>
        <HomeContainerHost
          initialSnapshotJson=""
          backgroundColor={snapshot?.theme.backgroundColor ?? '#FFFFFF'}
          debugOverlayEnabled={debugOverlayEnabled}
          style={styles.engine}
          onAction={onActionCallback}
          onRefresh={onRefreshCallback}
          onVisibleTabChange={onVisibleTabChangeCallback}
          onRenderError={onRenderErrorCallback}
          hybridRef={hybridRefCallback}
        />
        {slotViews}
      </HomeContainerSurface>
    );
  },
);

NativeHomeContainer.displayName = 'NativeHomeContainer';

export const HomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (props, ref) => {
    if (!isHomeContainerAvailable()) {
      return props.fallback ?? null;
    }
    return <NativeHomeContainer {...props} ref={ref} />;
  },
);

HomeContainer.displayName = 'HomeContainer';
