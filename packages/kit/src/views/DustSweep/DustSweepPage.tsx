import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreventRemove, useRoute } from '@react-navigation/core';
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
  ScrollView,
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepDetails } from './components/DustSweepDetails';
import { DustSweepNetworks } from './components/DustSweepFilters';
import { DustSweepSelection } from './components/DustSweepSelection';
import {
  DustSweepResult,
  DustSweepSummary,
} from './components/DustSweepSummary';
import { DustSweepFlow, useDustSweepFlow } from './DustSweepFlow';
import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { getDustSweepPresentation } from './stateMachine';

import type { NavigationAction, RouteProp } from '@react-navigation/core';

// Desktop layout: the token list column gives up width so the direction arrow
// sits in its own gap column with 12px clearance from both cards.
const DESKTOP_SELECTION_WIDTH = '51.2%';
const DESKTOP_COLUMN_GAP = 64;
const DESKTOP_DIRECTION_SIZE = 40;

function useDustSweepDesktopLayout() {
  const media = useMedia();
  return !platformEnv.isNative && media.gtMd;
}

function DustSweepDirectionIcon({
  desktop = false,
  running,
}: {
  desktop?: boolean;
  running: boolean;
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

function DustSweepResultDialog({
  state,
  onClose,
  onAgain,
  details = false,
}: {
  state: Parameters<typeof DustSweepResult>[0]['state'];
  onClose: () => void;
  onAgain: () => void | Promise<void>;
  details?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(details);
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const maxHeight = Math.max(
    0,
    platformEnv.isNative
      ? Math.min(Math.floor(height * 0.92), height - top - bottom)
      : height - 48,
  );

  if (showDetails)
    return (
      <DustSweepDetails
        state={state}
        maxHeight={maxHeight}
        onBack={() => setShowDetails(false)}
        onDone={onClose}
      />
    );
  return (
    <ScrollView maxHeight={Math.min(420, maxHeight)}>
      <DustSweepResult
        state={state}
        onDetails={
          state.phase === 'completed' ? onClose : () => setShowDetails(true)
        }
        onAgain={state.phase === 'completed' ? onAgain : onClose}
      />
    </ScrollView>
  );
}

function DustSweepPageContent() {
  const { session, selecting, sweepAgain, isFocused } = useDustSweep();
  const intl = useIntl();
  const { exit, continueRemoval, execution } = useDustSweepFlow();
  const desktop = useDustSweepDesktopLayout();
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
  const resultShown = useRef<string | undefined>(undefined);
  const resultDialog = useRef<ReturnType<typeof Dialog.show> | undefined>(
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
  const showResult = useCallback(
    (details: boolean) => {
      if (
        !state.snapshot ||
        resultDialog.current ||
        visibleLeaveDialog ||
        leaveDialog.current
      )
        return;
      const dialog = Dialog.show({
        testID: 'dust-sweep-result-sheet',
        nativeSheet: true,
        showHeader: false,
        showFooter: false,
        disableDrag: true,
        contentContainerProps: { px: 0, pb: 0 },
        onCloseStart: () => {
          if (resultDialog.current === dialog) resultDialog.current = undefined;
        },
        renderContent: (
          <DustSweepResultDialog
            state={state}
            details={details}
            onClose={() => {
              if (resultDialog.current === dialog) void dialog.close();
            }}
            onAgain={() => {
              if (resultDialog.current !== dialog) return;
              resultDialog.current = undefined;
              void dialog.close();
              sweepAgain();
            }}
          />
        ),
      });
      resultDialog.current = dialog;
    },
    [state, sweepAgain, visibleLeaveDialog],
  );
  const onDetails = useCallback(
    () => showResult(state.phase !== 'completed'),
    [showResult, state.phase],
  );
  useEffect(() => {
    if (
      desktop ||
      !isFocused ||
      visibleLeaveDialog ||
      state.phase !== 'completed' ||
      !state.snapshot ||
      resultShown.current === state.snapshot.id
    )
      return;
    resultShown.current = state.snapshot.id;
    showResult(false);
  }, [desktop, isFocused, visibleLeaveDialog, state, showResult]);
  useEffect(() => {
    if (!isFocused || selecting) {
      const dialog = resultDialog.current;
      resultDialog.current = undefined;
      void dialog?.close();
    }
  }, [isFocused, selecting]);
  useEffect(
    () => () => {
      const dialog = resultDialog.current;
      resultDialog.current = undefined;
      void dialog?.close();
    },
    [desktop],
  );
  const onDone = useCallback(() => exit(), [exit]);
  // The Home tab top bar (with its back button) is only rendered on the tab
  // route, so a Swap modal widened to desktop width keeps its own back control.
  const overlay = useIsOverlayPage();
  return (
    <Page testID="dust-sweep-page" scrollEnabled={desktop}>
      <Page.Header
        title={title}
        headerTitle={renderHeaderTitle}
        headerShown={!desktop}
      />
      <Page.Body>
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
                  onPress={onDone}
                />
              ) : null}
              <SizableText size="$heading2xl">{title}</SizableText>
            </XStack>
            <DustSweepNetworks desktop />
            {/* Stretch so the summary card always matches the token list card height. */}
            <XStack mt={30} flex={1} alignItems="stretch">
              <YStack width={DESKTOP_SELECTION_WIDTH}>
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
              <YStack flex={1}>
                <DustSweepSummary
                  desktop
                  onDone={onDone}
                  onDetails={onDetails}
                />
              </YStack>
            </XStack>
          </Page.Container>
        ) : (
          <YStack flex={1} minHeight={0}>
            <DustSweepSelection desktop={false} />
          </YStack>
        )}
      </Page.Body>
      {desktop ? null : (
        <Page.Footer safeAreaBottomMode="container">
          <YStack position="relative" bg="$bgApp">
            <DustSweepSummary
              desktop={false}
              onDone={onDone}
              onDetails={onDetails}
            />
            <Stack
              position="absolute"
              left="50%"
              x={-18}
              top={-18}
              width={36}
              height={36}
              borderWidth={1}
              borderColor="$borderSubdued"
              bg="$bgApp"
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
            >
              <DustSweepDirectionIcon
                running={isFocused && state.phase === 'running'}
              />
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
