import {
  type ComponentType,
  type PropsWithChildren,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  NitroModules,
  getHostComponent,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import HomeContainerConfig from '../nitrogen/generated/shared/json/HomeContainerConfig.json';

import {
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerCapabilities,
  type IHomeContainerOwner,
  type IHomeContainerProps,
  type IHomeContainerRef,
  type IHomeContainerSlot,
  type IHomeContainerSlots,
  isHomeContainerTransportResultForSubmission,
  parseHomeContainerTransportResult,
  serializeHomeContainerPayload,
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

interface IRenderedTransportIdentity {
  owner: IHomeContainerOwner;
  revision: number;
}

function ownersMatch(
  left: IHomeContainerOwner,
  right: IHomeContainerOwner,
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function createReservedSlot(slot: IHomeContainerSlot): IHomeContainerSlot {
  return { ...slot, content: null, interaction: 'none' };
}

function createReservedSlots(slots: IHomeContainerSlots): IHomeContainerSlots {
  const mapSlots = <T extends string>(
    values: Partial<Record<T, IHomeContainerSlot>> | undefined,
  ): Partial<Record<T, IHomeContainerSlot>> | undefined => {
    if (!values) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(values).flatMap(([key, slot]) =>
        slot ? [[key, createReservedSlot(slot as IHomeContainerSlot)]] : [],
      ),
    ) as Partial<Record<T, IHomeContainerSlot>>;
  };
  return {
    backgroundColor: slots.backgroundColor,
    accountRow: slots.accountRow
      ? createReservedSlot(slots.accountRow)
      : undefined,
    balance: slots.balance ? createReservedSlot(slots.balance) : undefined,
    headerActionRow: slots.headerActionRow
      ? createReservedSlot(slots.headerActionRow)
      : undefined,
    contentHeaders: mapSlots(slots.contentHeaders),
    contentStates: mapSlots(slots.contentStates),
    tabAccessories: mapSlots(slots.tabAccessories),
    contentFooters: Object.fromEntries(
      Object.entries(slots.contentFooters ?? {}).map(([tabId, footers]) => [
        tabId,
        mapSlots(footers),
      ]),
    ),
  };
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

const NativeHomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (
    {
      snapshot,
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
      onTransportResult,
    },
    ref,
  ) => {
    const { width: windowWidth } = useWindowDimensions();
    const nativeRef = useRef<HomeContainerNativeView | null>(null);
    const [renderedTransport, setRenderedTransport] =
      useState<IRenderedTransportIdentity>();
    const submittedTransportRef = useRef<
      IRenderedTransportIdentity | undefined
    >(undefined);
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
        setProtocolV2Snapshot: (nextSnapshot) => {
          submittedTransportRef.current = {
            owner: nextSnapshot.owner,
            revision: nextSnapshot.revision,
          };
          setRenderedTransport((current) =>
            current && ownersMatch(current.owner, nextSnapshot.owner)
              ? current
              : undefined,
          );
          nativeRef.current?.setSnapshot(
            serializeHomeContainerPayload(nextSnapshot),
          );
        },
        applyProtocolV2Patch: (patch) => {
          submittedTransportRef.current = {
            owner: patch.owner,
            revision: patch.revision,
          };
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
    const onIntentRef = useRef(onIntent);
    onIntentRef.current = onIntent;
    const onTransportResultRef = useRef(onTransportResult);
    onTransportResultRef.current = onTransportResult;

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
    const stableOnTransportResult = useCallback((resultJson: string) => {
      const result = parseHomeContainerTransportResult(resultJson);
      if (
        result &&
        isHomeContainerTransportResultForSubmission(
          result,
          submittedTransportRef.current,
        ) &&
        (result.kind === 'applied' || result.kind === 'duplicate')
      ) {
        setRenderedTransport({
          owner: result.owner,
          revision: result.revision,
        });
      } else if (
        result?.kind === 'needSnapshot' &&
        isHomeContainerTransportResultForSubmission(
          result,
          submittedTransportRef.current,
        )
      ) {
        setRenderedTransport(undefined);
      }
      onTransportResultRef.current?.(resultJson);
    }, []);

    const hasOnAction = Boolean(onAction);
    const hasOnRefresh = Boolean(onRefresh);
    const hasOnVisibleTabChange = Boolean(onVisibleTabChange);
    const hasOnRenderError = Boolean(onRenderError);
    const hasOnIntent = Boolean(onIntent);
    const hasOnTransportResult = Boolean(onTransportResult);
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
    const onTransportResultCallback = useMemo(
      () =>
        hasOnTransportResult
          ? nitroCallback(stableOnTransportResult)
          : undefined,
      [hasOnTransportResult, stableOnTransportResult],
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
    const resolvedBackgroundColor = resolveHomeContainerBackgroundColor({
      snapshotBackgroundColor: snapshot?.theme.backgroundColor,
      slotBackgroundColor:
        slotBundle?.slots.backgroundColor ?? slots?.backgroundColor,
    });

    const resolvedSlots = useMemo(() => {
      if (!slotBundle) {
        return slots;
      }
      if (
        renderedTransport &&
        ownersMatch(slotBundle.owner, renderedTransport.owner) &&
        slotBundle.semanticRevision === renderedTransport.revision &&
        slotBundle.slotContractRevision ===
          HOME_CONTAINER_SLOT_CONTRACT_REVISION
      ) {
        return slotBundle.slots;
      }
      return createReservedSlots(slotBundle.slots);
    }, [renderedTransport, slotBundle, slots]);

    const slotViews = useMemo(() => {
      if (!resolvedSlots) {
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
    }, [resolvedBackgroundColor, resolvedSlots, windowWidth]);

    return (
      <HomeContainerSurface style={style} testID={testID}>
        <HomeContainerHost
          initialSnapshotJson=""
          backgroundColor={resolvedBackgroundColor}
          debugOverlayEnabled={debugOverlayEnabled}
          style={styles.engine}
          onAction={onActionCallback}
          onRefresh={onRefreshCallback}
          onVisibleTabChange={onVisibleTabChangeCallback}
          onRenderError={onRenderErrorCallback}
          onIntent={onIntentCallback}
          onTransportResult={onTransportResultCallback}
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
