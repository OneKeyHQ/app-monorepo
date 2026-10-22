import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  useFocusEffect,
  usePreventRemove,
  useRoute,
} from '@react-navigation/core';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  Dialog,
  Icon,
  IconButton,
  NavBackButton,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useIsOverlayPage } from '@onekeyhq/components/src/hocs/PageType';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  createHideTabBarOwnerId,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';

import { useHeaderHeightCacheKey } from '../Earn/hooks/useHeaderHeightCacheKey';
import { useNativeStackHeaderHeightEstimate } from '../Earn/hooks/useNativeStackHeaderHeightEstimate';
import { useSettledHeaderHeight } from '../Earn/hooks/useSettledHeaderHeight';

import { DustSweepDetails } from './components/DustSweepDetails';
import { DustSweepNetworks } from './components/DustSweepFilters';
import {
  DUST_SWEEP_DESKTOP_CARD_MAX_HEIGHT,
  DUST_SWEEP_DESKTOP_CARD_MIN_HEIGHT,
  DUST_SWEEP_MOBILE_DIRECTION_SIZE,
  DustSweepSelection,
} from './components/DustSweepSelection';
import { DustSweepSummary } from './components/DustSweepSummary';
import { DustSweepFlow, useDustSweepFlow } from './DustSweepFlow';
import {
  DustSweepProvider,
  DustSweepScreenProvider,
  useDustSweep,
} from './DustSweepProvider';
import { getDustSweepPresentation } from './stateMachine';

import type { IDustSweepState } from './stateMachine';
import type { NavigationAction, RouteProp } from '@react-navigation/core';

// Desktop layout: two equal-width cards with the direction arrow in its own
// gap column, 12px clear of both.
const DESKTOP_COLUMN_GAP = 64;
const DESKTOP_DIRECTION_SIZE = 40;
// Let the page content fill the window so the cards can take the remaining
// height instead of a fixed one that overflows short windows.
const DESKTOP_SCROLL_PROPS = { contentContainerStyle: { flexGrow: 1 } };

function useDustSweepDesktopLayout() {
  const media = useMedia();
  return !platformEnv.isNative && media.gtMd;
}

function DustSweepDirectionIcon({
  desktop = false,
  running = false,
}: {
  desktop?: boolean;
  running?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const animated = running && !reducedMotion;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    if (animated)
      progress.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      );
    return () => cancelAnimation(progress);
  }, [animated, progress]);
  const style = useAnimatedStyle(() => {
    const offset = animated
      ? interpolate(progress.value, [0, 1], [-10, 10])
      : 0;
    return {
      opacity: animated
        ? interpolate(progress.value, [0, 0.25, 0.75, 1], [0, 1, 1, 0])
        : 1,
      transform: [
        { translateX: desktop ? offset : 0 },
        { translateY: desktop ? 0 : offset },
      ],
    };
  }, [animated, desktop, progress]);
  return (
    <Stack width={20} height={20} overflow="hidden">
      <Animated.View style={style}>
        <Icon
          name={desktop ? 'ArrowRightOutline' : 'ArrowBottomOutline'}
          size="$5"
          color="$iconSubdued"
        />
      </Animated.View>
    </Stack>
  );
}

// The completed result stays on the page, so the sheet only carries the
// per-token breakdown; Back and Done both close it.
function DustSweepDetailsDialog({
  state,
  onClose,
}: {
  state: IDustSweepState;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const maxHeight = Math.max(
    0,
    platformEnv.isNative
      ? Math.min(Math.floor(height * 0.92), height - top - bottom)
      : height - 48,
  );
  return (
    <DustSweepDetails
      state={state}
      maxHeight={maxHeight}
      onBack={onClose}
      onDone={onClose}
    />
  );
}

type IDustSweepLiveSnapshot = {
  model: ReturnType<typeof useDustSweep>;
  onDetails: () => void;
  onLeave: () => void;
};

// Dialogs render outside the page tree, so the live sheet reads the latest
// page model through this tiny store instead of the Dust Sweep context.
function createDustSweepLiveStore(initial: IDustSweepLiveSnapshot) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set: (next: IDustSweepLiveSnapshot) => {
      if (
        next.model === snapshot.model &&
        next.onDetails === snapshot.onDetails &&
        next.onLeave === snapshot.onLeave
      )
        return;
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Mobile: the converting → completed view as a bottom sheet over the page,
// like the Swap order review.
function DustSweepLiveSheet({
  store,
  onHeightChange,
}: {
  store: ReturnType<typeof createDustSweepLiveStore>;
  onHeightChange: (height: number) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const { model, onDetails, onLeave } = useSyncExternalStore(
    store.subscribe,
    store.get,
    store.get,
  );
  // Done resets the session before the sheet finishes closing; keep showing
  // the last sweep instead of flashing the token selection.
  const lastSweep = useRef(model);
  if (!model.selecting) lastSweep.current = model;
  return (
    <DustSweepScreenProvider value={lastSweep.current}>
      {/* The sheet's height (plus the safe area under it) is how much of the
          token list it covers. */}
      <Stack
        testID="dust-sweep-live-sheet-content"
        onLayout={(event) =>
          onHeightChange(event.nativeEvent.layout.height + bottom)
        }
      >
        <DustSweepSummary
          desktop={false}
          onDetails={onDetails}
          onLeave={onLeave}
        />
      </Stack>
    </DustSweepScreenProvider>
  );
}

function DustSweepPageContent() {
  const model = useDustSweep();
  const { session, selecting, isFocused, networks, loadStatus } = model;
  const intl = useIntl();
  const { exit, continueRemoval, execution } = useDustSweepFlow();
  const desktop = useDustSweepDesktopLayout();
  // As a Home sub page on iOS 26 the transparent nav bar overlaps the body, so
  // offset it by the settled bar height (same approach as the Borrow home).
  const headerHeight = useHeaderHeight();
  const headerHeightCacheKey = useHeaderHeightCacheKey();
  const estimatedHeaderHeight = useNativeStackHeaderHeightEstimate();
  const { paddingTop: bodyPaddingTop, isSettled: isHeaderHeightSettled } =
    useSettledHeaderHeight(headerHeight, {
      cacheKey: headerHeightCacheKey,
      estimatedHeaderHeight,
    });
  const [approvedRemovalAction, setApprovedRemovalAction] = useState<
    NavigationAction | undefined
  >(undefined);
  const leaveDialog = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const [visibleLeaveDialog, setVisibleLeaveDialog] = useState<
    ReturnType<typeof Dialog.show> | undefined
  >(undefined);
  const leavePending = useRef(false);
  const detailsDialog = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const { state } = session;
  const { progress, unknown } = getDustSweepPresentation(state);
  const title = intl.formatMessage({ id: ETranslations.title_dust_sweep });
  let subtitle: string | undefined;
  if (!selecting && state.phase !== 'completed') {
    if (unknown)
      subtitle = intl.formatMessage({
        id: ETranslations.global_pending,
      });
    else if (state.phase === 'paused')
      subtitle = `${intl.formatMessage({
        id: ETranslations.sweep_dust_sweep_paused,
      })} ${progress}/${state.items.length}`;
    else
      subtitle = intl.formatMessage(
        { id: ETranslations.sweep_dust_sweep_conversion_progress },
        { current: progress, total: state.items.length },
      );
  }
  const renderHeaderTitle = useCallback(
    () => (
      <YStack
        height={40}
        justifyContent="center"
        alignItems="center"
        maxWidth={260}
      >
        <SizableText size="$headingLg" numberOfLines={1}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText
            testID="dust-sweep-progress-label"
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
          >
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
    ),
    [subtitle, title],
  );

  usePreventRemove(
    execution && !approvedRemovalAction && !selecting,
    ({ data }) => {
      if (state.phase === 'completed') {
        setApprovedRemovalAction(data.action);
        return;
      }
      if (leaveDialog.current || visibleLeaveDialog) return;
      const leaveTitle = intl.formatMessage({
        id: ETranslations.sweep_leave_dust_sweep_confirmation,
      });
      const leaveDescription = unknown
        ? intl.formatMessage({
            id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
          })
        : [
            intl.formatMessage({
              id: ETranslations.sweep_leave_dust_sweep_warning,
            }),
            state.items.some(
              (item) =>
                ['signing', 'broadcasted'].includes(item.status) ||
                item.approvalTxIds?.length,
            )
              ? intl.formatMessage({
                  id: ETranslations.swap_review_tx_pending,
                })
              : undefined,
          ]
            .filter(Boolean)
            .join('\n\n');
      const dialog = Dialog.show({
        nativeCentered: true,
        floatingPanelProps: platformEnv.isNative ? { width: 350 } : undefined,
        title: leaveTitle,
        description: leaveDescription,
        ...(platformEnv.isNative
          ? {
              showHeader: false,
              contentContainerProps: { px: 20, pt: 20, pb: 38 },
              renderContent: (
                <YStack>
                  <SizableText size="$headingLg">{leaveTitle}</SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    mt="$2"
                    minHeight={60}
                  >
                    {leaveDescription}
                  </SizableText>
                </YStack>
              ),
              footerProps: { flexDirection: 'row-reverse', gap: 12 },
              cancelButtonProps: { height: 46, minHeight: 46, py: 10 },
            }
          : undefined),
        onConfirmText: intl.formatMessage({
          id: ETranslations.sweep_leave_dust_sweep,
        }),
        confirmButtonProps: {
          testID: 'dust-sweep-confirm-leave',
          ...(platformEnv.isNative
            ? { height: 46, minHeight: 46, py: 10 }
            : undefined),
        },
        tone: 'destructive',
        onBeforeClose: () =>
          leaveDialog.current !== dialog || !leavePending.current,
        onConfirm: async ({ preventClose }) => {
          if (leaveDialog.current !== dialog) return;
          if (leavePending.current) {
            preventClose();
            return;
          }
          leavePending.current = true;
          try {
            const left = await session.leave();
            if (leaveDialog.current !== dialog) return;
            if (left === false) {
              Toast.warning({
                title: intl.formatMessage({
                  id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
                }),
              });
              return;
            }
            setApprovedRemovalAction(data.action);
          } finally {
            leavePending.current = false;
          }
        },
        onCloseStart: () => {
          if (leaveDialog.current === dialog) leaveDialog.current = undefined;
        },
        onClose: () => {
          setVisibleLeaveDialog((current) =>
            current === dialog ? undefined : current,
          );
        },
      });
      leaveDialog.current = dialog;
      setVisibleLeaveDialog(dialog);
    },
  );
  const closeLeaveDialog = useCallback(() => {
    const dialog = leaveDialog.current;
    // Revoke callbacks immediately; the result waits for the closing animation.
    leaveDialog.current = undefined;
    void dialog?.close();
  }, []);
  useEffect(() => {
    if (
      (!isFocused || selecting || state.phase === 'completed') &&
      !leavePending.current
    )
      closeLeaveDialog();
  }, [isFocused, selecting, state.phase, closeLeaveDialog]);
  useEffect(() => closeLeaveDialog, [closeLeaveDialog]);
  useEffect(() => {
    if (approvedRemovalAction) continueRemoval(approvedRemovalAction);
  }, [approvedRemovalAction, continueRemoval]);
  // Details (offered while a submission is unknown) opens the per-token
  // breakdown; the completed result itself stays in the summary.
  const onDetails = useCallback(() => {
    if (
      !state.snapshot ||
      detailsDialog.current ||
      visibleLeaveDialog ||
      leaveDialog.current
    )
      return;
    const dialog = Dialog.show({
      testID: 'dust-sweep-details-sheet',
      showHeader: false,
      showFooter: false,
      disableDrag: true,
      contentContainerProps: { px: 0, pb: 0 },
      onCloseStart: () => {
        if (detailsDialog.current === dialog) detailsDialog.current = undefined;
      },
      renderContent: (
        <DustSweepDetailsDialog
          state={state}
          onClose={() => {
            if (detailsDialog.current === dialog) void dialog.close();
          }}
        />
      ),
    });
    detailsDialog.current = dialog;
  }, [state, visibleLeaveDialog]);
  useEffect(() => {
    if (!isFocused || selecting) {
      const dialog = detailsDialog.current;
      detailsDialog.current = undefined;
      void dialog?.close();
    }
  }, [isFocused, selecting]);
  useEffect(
    () => () => {
      const dialog = detailsDialog.current;
      detailsDialog.current = undefined;
      void dialog?.close();
    },
    [desktop],
  );
  // Wrapped so the press event is never passed to exit() as an action.
  const onBack = useCallback(() => exit(), [exit]);
  const [liveStore] = useState(() =>
    createDustSweepLiveStore({ model, onDetails, onLeave: onBack }),
  );
  useLayoutEffect(() => {
    liveStore.set({ model, onDetails, onLeave: onBack });
  });
  const liveSheet = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const [liveSheetHeight, setLiveSheetHeight] = useState(0);
  // It stays open until Done returns to selection (no drag or backdrop close
  // mid-sweep), and yields to the leave confirmation.
  const showLiveSheet =
    !desktop && !selecting && isFocused && !visibleLeaveDialog;
  useEffect(() => {
    if (!showLiveSheet) {
      const dialog = liveSheet.current;
      liveSheet.current = undefined;
      void dialog?.close();
      return;
    }
    if (liveSheet.current) return;
    const dialog = Dialog.show({
      testID: 'dust-sweep-live-sheet',
      showHeader: false,
      showFooter: false,
      disableDrag: true,
      dismissOnOverlayPress: false,
      disableSystemClose: true,
      contentContainerProps: { px: 0, pb: 0 },
      onCloseStart: () => {
        if (liveSheet.current === dialog) liveSheet.current = undefined;
      },
      renderContent: (
        <DustSweepLiveSheet
          store={liveStore}
          onHeightChange={setLiveSheetHeight}
        />
      ),
    });
    liveSheet.current = dialog;
  }, [liveStore, showLiveSheet]);
  useEffect(
    () => () => {
      const dialog = liveSheet.current;
      liveSheet.current = undefined;
      void dialog?.close();
    },
    [],
  );
  // The Home tab top bar (with its back button) is only rendered on the tab
  // route, so a Swap modal widened to desktop width keeps its own back control.
  const overlay = useIsOverlayPage();
  // A wallet with no assets has no network chips, so drop the empty row.
  const showNetworks = loadStatus === 'loading' || networks.length > 0;
  return (
    <Page
      testID="dust-sweep-page"
      scrollEnabled={desktop}
      scrollProps={desktop ? DESKTOP_SCROLL_PROPS : undefined}
    >
      <Page.Header
        title={title}
        headerTitle={renderHeaderTitle}
        headerShown={!desktop}
      />
      <Page.Body
        pt={desktop ? undefined : bodyPaddingTop}
        opacity={desktop || isHeaderHeightSettled ? 1 : 0}
      >
        {desktop ? (
          // Title spacing matches other desktop Home sub pages (ApprovalListPage);
          // mb matches the 30px gap below the network chips.
          <Page.Container flex={1} pb="$6">
            <XStack mt="$8" mb={30} alignItems="center" gap="$2">
              {overlay ? (
                <IconButton
                  testID="dust-sweep-back"
                  icon="ChevronLeftOutline"
                  variant="tertiary"
                  mx={0}
                  my={0}
                  accessibilityLabel={intl.formatMessage({
                    id: ETranslations.global_back,
                  })}
                  onPress={onBack}
                />
              ) : null}
              <SizableText size="$heading2xl">{title}</SizableText>
            </XStack>
            {showNetworks ? <DustSweepNetworks desktop /> : null}
            {/* Stretch so the summary card always matches the token list card height. */}
            <XStack
              mt={showNetworks ? 30 : 0}
              flex={1}
              minHeight={DUST_SWEEP_DESKTOP_CARD_MIN_HEIGHT}
              maxHeight={DUST_SWEEP_DESKTOP_CARD_MAX_HEIGHT}
              alignItems="stretch"
            >
              <YStack flex={1} flexBasis={0} minWidth={0}>
                <DustSweepSelection desktop />
              </YStack>
              <Stack
                width={DESKTOP_COLUMN_GAP}
                alignItems="center"
                justifyContent="center"
              >
                <Stack
                  width={DESKTOP_DIRECTION_SIZE}
                  height={DESKTOP_DIRECTION_SIZE}
                  borderWidth={1}
                  borderColor="$borderSubdued"
                  bg="$bgApp"
                  borderRadius="$full"
                  alignItems="center"
                  justifyContent="center"
                >
                  <DustSweepDirectionIcon
                    desktop
                    running={isFocused && state.phase === 'running'}
                  />
                </Stack>
              </Stack>
              <YStack flex={1} flexBasis={0} minWidth={0}>
                <DustSweepSummary desktop onDetails={onDetails} />
              </YStack>
            </XStack>
          </Page.Container>
        ) : (
          <YStack flex={1} minHeight={0}>
            <DustSweepSelection
              desktop={false}
              obscuredBottom={liveSheetHeight}
            />
          </YStack>
        )}
      </Page.Body>
      {/* Mobile picks tokens in this footer; the sweep itself runs in the
          live sheet, so the footer steps aside while it is open. */}
      {desktop || !selecting ? null : (
        <Page.Footer safeAreaBottomMode="container">
          <YStack position="relative" bg="$bgApp">
            <DustSweepSummary desktop={false} onDetails={onDetails} />
            <Stack
              position="absolute"
              left="50%"
              x={-DUST_SWEEP_MOBILE_DIRECTION_SIZE / 2}
              top={-DUST_SWEEP_MOBILE_DIRECTION_SIZE / 2}
              width={DUST_SWEEP_MOBILE_DIRECTION_SIZE}
              height={DUST_SWEEP_MOBILE_DIRECTION_SIZE}
              borderWidth={1}
              borderColor="$borderSubdued"
              bg="$bgApp"
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
            >
              <DustSweepDirectionIcon />
            </Stack>
          </YStack>
        </Page.Footer>
      )}
    </Page>
  );
}

// Same top bar as other desktop Home sub pages (e.g. ApprovalListPage).
function DustSweepDesktopHeader() {
  const navigation = useAppNavigation();
  const handleBackPress = useCallback(() => {
    navigation.pop();
  }, [navigation]);
  const customHeaderLeft = useMemo(
    () => <NavBackButton onPress={handleBackPress} />,
    [handleBackPress],
  );
  return (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.SubPage}
      customHeaderLeftItems={customHeaderLeft}
    />
  );
}

export default function DustSweepPage() {
  const route =
    useRoute<RouteProp<{ DustSweep: IDustSweepRouteParams }, 'DustSweep'>>();
  const intl = useIntl();
  const desktop = useDustSweepDesktopLayout();
  // The Home tab top bar only belongs to the tab route, not to the Swap modal
  // (e.g. a modal opened at a narrow width and then widened).
  const overlay = useIsOverlayPage();
  // Small screens open this Home sub page full screen, so the bottom tab bar
  // must not cover the action footer.
  useFocusEffect(
    useCallback(() => {
      if (desktop) return undefined;
      const ownerId = createHideTabBarOwnerId('dust-sweep');
      requestHideTabBar(ownerId);
      return () => {
        releaseHideTabBar(ownerId);
      };
    }, [desktop]),
  );
  if (!route.params?.walletId || !route.params.accountId) {
    return (
      <Page>
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.title_dust_sweep })}
        />
        <Page.Body>
          <YStack p="$5">
            <SizableText>
              {intl.formatMessage({ id: ETranslations.global_select_wallet })}
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }
  return (
    <DustSweepProvider
      key={`${route.params.walletId}:${route.params.indexedAccountId ?? ''}:${route.params.accountId}:${route.params.networkId ?? ''}`}
      params={route.params}
    >
      {desktop && !overlay ? (
        <DustSweepDesktopHeader />
      ) : (
        <Page.Header headerShown={false} />
      )}
      <DustSweepFlow component={DustSweepPageContent} />
    </DustSweepProvider>
  );
}
