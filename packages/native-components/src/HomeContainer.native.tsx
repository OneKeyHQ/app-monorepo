import {
  type ComponentType,
  type PropsWithChildren,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
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
  type IHomeContainerProps,
  type IHomeContainerRef,
  type IHomeContainerSlot,
  type IHomeContainerSlotBundle,
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

interface IPendingProtocolV3Transport {
  json: string;
  kind: 'patch' | 'snapshot';
}

interface IStagedSlotBundle {
  bundle: IHomeContainerSlotBundle;
  parentAtSubmission: IHomeContainerSlotBundle | undefined;
}

function bundlesIdentifySameCommit(
  left: IHomeContainerSlotBundle | undefined,
  right: IHomeContainerSlotBundle | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }
  return (
    left.owner.scopeKey === right.owner.scopeKey &&
    left.owner.sessionId === right.owner.sessionId &&
    left.semanticRevision === right.semanticRevision
  );
}

function selectLatestSlotBundle(
  staged: IStagedSlotBundle | undefined,
  parentBundle: IHomeContainerSlotBundle | undefined,
): IHomeContainerSlotBundle | undefined {
  const stagedBundle = staged?.bundle;
  if (!stagedBundle || !parentBundle) {
    return stagedBundle ?? parentBundle;
  }
  const sameOwner =
    stagedBundle.owner.scopeKey === parentBundle.owner.scopeKey &&
    stagedBundle.owner.sessionId === parentBundle.owner.sessionId;
  if (!sameOwner) {
    return bundlesIdentifySameCommit(staged.parentAtSubmission, parentBundle)
      ? stagedBundle
      : parentBundle;
  }
  return parentBundle.semanticRevision >= stagedBundle.semanticRevision
    ? parentBundle
    : stagedBundle;
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
      onSnapshotRequired,
    },
    ref,
  ) => {
    const { width: windowWidth } = useWindowDimensions();
    const nativeRef = useRef<HomeContainerNativeView | null>(null);
    const [stagedSlotBundle, setStagedSlotBundle] =
      useState<IStagedSlotBundle>();
    const slotBundleRef = useRef(slotBundle);
    slotBundleRef.current = slotBundle;
    const pendingProtocolV3TransportRef = useRef<
      IPendingProtocolV3Transport | undefined
    >(undefined);
    const initialSnapshotRef = useRef(initialSnapshot);
    const initialSnapshotJsonRef = useRef(
      initialSnapshot ? serializeHomeContainerPayload(initialSnapshot) : '',
    );

    useLayoutEffect(() => {
      const pendingProtocolV3Transport = pendingProtocolV3TransportRef.current;
      if (!pendingProtocolV3Transport || !nativeRef.current) {
        return;
      }
      pendingProtocolV3TransportRef.current = undefined;
      if (pendingProtocolV3Transport.kind === 'snapshot') {
        nativeRef.current.setSnapshot(pendingProtocolV3Transport.json);
      } else {
        nativeRef.current.applyPatch(pendingProtocolV3Transport.json);
      }
    });

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
        setProtocolV2Snapshot: (nextSnapshot, nextSlots) => {
          pendingProtocolV3TransportRef.current = undefined;
          setStagedSlotBundle(
            nextSlots
              ? {
                  bundle: {
                    owner: nextSnapshot.owner,
                    semanticRevision: nextSnapshot.revision,
                    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
                    slots: nextSlots,
                  },
                  parentAtSubmission: slotBundleRef.current,
                }
              : undefined,
          );
          nativeRef.current?.setSnapshot(
            serializeHomeContainerPayload(nextSnapshot),
          );
        },
        applyProtocolV2Patch: (patch, nextSlots) => {
          setStagedSlotBundle(
            nextSlots
              ? {
                  bundle: {
                    owner: patch.owner,
                    semanticRevision: patch.revision,
                    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
                    slots: nextSlots,
                  },
                  parentAtSubmission: slotBundleRef.current,
                }
              : undefined,
          );
          nativeRef.current?.applyPatch(serializeHomeContainerPayload(patch));
        },
        setProtocolV3Snapshot: (nextSnapshot, nextSlots) => {
          const owner = {
            scopeKey: nextSnapshot.identity.scopeKey,
            sessionId: nextSnapshot.identity.sessionId,
          };
          setStagedSlotBundle(
            nextSlots
              ? {
                  bundle: {
                    owner,
                    semanticRevision: nextSnapshot.identity.storeCommitId,
                    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
                    slots: nextSlots,
                  },
                  parentAtSubmission: slotBundleRef.current,
                }
              : undefined,
          );
          pendingProtocolV3TransportRef.current = {
            json: serializeHomeContainerPayload(nextSnapshot),
            kind: 'snapshot',
          };
        },
        applyProtocolV3Patch: (patch, nextSlots) => {
          const owner = {
            scopeKey: patch.identity.scopeKey,
            sessionId: patch.identity.sessionId,
          };
          setStagedSlotBundle(
            nextSlots
              ? {
                  bundle: {
                    owner,
                    semanticRevision: patch.identity.storeCommitId,
                    slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
                    slots: nextSlots,
                  },
                  parentAtSubmission: slotBundleRef.current,
                }
              : undefined,
          );
          pendingProtocolV3TransportRef.current = {
            json: serializeHomeContainerPayload(patch),
            kind: 'patch',
          };
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
    const onSnapshotRequiredRef = useRef(onSnapshotRequired);
    onSnapshotRequiredRef.current = onSnapshotRequired;

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
    const stableOnSnapshotRequired = useCallback((requestJson: string) => {
      onSnapshotRequiredRef.current?.(requestJson);
    }, []);

    const hasOnAction = Boolean(onAction);
    const hasOnRefresh = Boolean(onRefresh);
    const hasOnVisibleTabChange = Boolean(onVisibleTabChange);
    const hasOnRenderError = Boolean(onRenderError);
    const hasOnIntent = Boolean(onIntent);
    const hasOnSnapshotRequired = Boolean(onSnapshotRequired);
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
    const onSnapshotRequiredCallback = useMemo(
      () =>
        hasOnSnapshotRequired
          ? nitroCallback(stableOnSnapshotRequired)
          : undefined,
      [hasOnSnapshotRequired, stableOnSnapshotRequired],
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
    const authoritativeSlotBundle = useMemo(
      () => selectLatestSlotBundle(stagedSlotBundle, slotBundle),
      [slotBundle, stagedSlotBundle],
    );
    const resolvedBackgroundColor = resolveHomeContainerBackgroundColor({
      snapshotBackgroundColor:
        initialSnapshotRef.current?.payload.theme.backgroundColor,
      slotBackgroundColor:
        authoritativeSlotBundle?.slots.backgroundColor ??
        slots?.backgroundColor,
    });

    const resolvedSlots = useMemo(
      () =>
        resolveHomeContainerSlots({
          currentBundle: authoritativeSlotBundle,
          legacySlots: slots,
        }),
      [authoritativeSlotBundle, slots],
    );

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
        const authority =
          slot.authority?.slotId === key ? slot.authority : undefined;
        return (
          <HomeContainerSlot
            key={key}
            ownerScopeKey={authority?.owner.scopeKey ?? ''}
            ownerSessionId={authority?.owner.sessionId ?? ''}
            producedByStoreCommitId={authority?.producedByStoreCommitId ?? -1}
            slotKey={key}
            slotRevision={authority?.slotRevision ?? -1}
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
          initialSnapshotJson={initialSnapshotJsonRef.current}
          backgroundColor={resolvedBackgroundColor}
          debugOverlayEnabled={debugOverlayEnabled}
          style={styles.engine}
          onAction={onActionCallback}
          onRefresh={onRefreshCallback}
          onVisibleTabChange={onVisibleTabChangeCallback}
          onRenderError={onRenderErrorCallback}
          onIntent={onIntentCallback}
          onSnapshotRequired={onSnapshotRequiredCallback}
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
