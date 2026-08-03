import {
  type ComponentType,
  type PropsWithChildren,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
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
  type IHomeContainerProps,
  type IHomeContainerRef,
  type IHomeContainerSlot,
  serializeHomeContainerState,
} from './HomeContainer.types';
import { resolveHomeContainerBackgroundColor } from './HomeContainerBackground';
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

const NativeHomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (
    {
      state,
      slotBundle,
      style,
      testID,
      debugOverlayEnabled = false,
      onRenderError,
      onIntent,
    },
    ref,
  ) => {
    const { width: windowWidth } = useWindowDimensions();
    const nativeRef = useRef<HomeContainerNativeView | null>(null);
    const initialStateJsonRef = useRef(
      state ? serializeHomeContainerState(state) : '',
    );
    const lastSubmittedStateJsonRef = useRef(initialStateJsonRef.current);
    const stateJson = useMemo(
      () => (state ? serializeHomeContainerState(state) : ''),
      [state],
    );

    useLayoutEffect(() => {
      if (stateJson && stateJson !== lastSubmittedStateJsonRef.current) {
        lastSubmittedStateJsonRef.current = stateJson;
        nativeRef.current?.setState(stateJson);
      }
    }, [stateJson]);

    const imperativeHandle = useMemo<IHomeContainerRef>(
      () => ({
        setState: (nextState) => {
          const nextStateJson = serializeHomeContainerState(nextState);
          lastSubmittedStateJsonRef.current = nextStateJson;
          nativeRef.current?.setState(nextStateJson);
        },
        completeRefresh: (requestId) => {
          nativeRef.current?.completeRefresh(requestId);
        },
        selectTab: (tabId, animated = true) => {
          nativeRef.current?.selectTab(tabId, animated);
        },
      }),
      [],
    );
    useImperativeHandle(ref, () => imperativeHandle, [imperativeHandle]);

    const onRenderErrorRef = useRef(onRenderError);
    onRenderErrorRef.current = onRenderError;
    const onIntentRef = useRef(onIntent);
    onIntentRef.current = onIntent;

    const stableOnRenderError = useCallback((code: string, message: string) => {
      onRenderErrorRef.current?.(code, message);
    }, []);
    const stableOnIntent = useCallback((intentJson: string) => {
      onIntentRef.current?.(intentJson);
    }, []);

    const onRenderErrorCallback = useMemo(
      () => (onRenderError ? nitroCallback(stableOnRenderError) : undefined),
      [onRenderError, stableOnRenderError],
    );
    const onIntentCallback = useMemo(
      () => (onIntent ? nitroCallback(stableOnIntent) : undefined),
      [onIntent, stableOnIntent],
    );
    const stableHybridRef = useCallback((nextRef: HomeContainerNativeView) => {
      nativeRef.current = nextRef;
    }, []);
    const hybridRefCallback = useMemo(
      () => nitroCallback(stableHybridRef),
      [stableHybridRef],
    );

    // Slot presence owns presentation; native owner checks only gate interaction.
    const presentedBundle = slotBundle;
    const resolvedSlots = presentedBundle?.slots;
    const resolvedBackgroundColor = resolveHomeContainerBackgroundColor({
      snapshotBackgroundColor: state?.payload.theme.backgroundColor,
      slotBackgroundColor: resolvedSlots?.backgroundColor,
    });

    const slotViews = useMemo(() => {
      if (!resolvedSlots || !presentedBundle) {
        return null;
      }
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
        const interactive = slot.interaction === 'tap';
        return (
          <HomeContainerSlot
            key={key}
            ownerScopeKey={presentedBundle.owner.scopeKey}
            ownerSessionId={presentedBundle.owner.sessionId}
            slotKey={key}
            testID={`HomeContainer.Slot.${key}`}
            pointerEvents={interactive ? 'auto' : 'none'}
            style={[
              styles.slot,
              getSlotLayoutStyle(key),
              getSlotWidthStyle(key, windowWidth),
              slot.height === undefined ? undefined : { height: slot.height },
              { backgroundColor: resolvedBackgroundColor },
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
    }, [presentedBundle, resolvedBackgroundColor, resolvedSlots, windowWidth]);

    return (
      <HomeContainerSurface style={style} testID={testID}>
        <HomeContainerHost
          initialStateJson={initialStateJsonRef.current}
          backgroundColor={resolvedBackgroundColor}
          debugOverlayEnabled={debugOverlayEnabled}
          style={styles.engine}
          onRenderError={onRenderErrorCallback}
          onIntent={onIntentCallback}
          hybridRef={hybridRefCallback}
        />
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
