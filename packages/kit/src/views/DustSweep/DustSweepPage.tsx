import { useCallback, useEffect, useRef, useState } from 'react';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  const media = useMedia();
  const desktop = !platformEnv.isNative && media.gtMd;
  const [allowLeave, setAllowLeave] = useState(false);
  const pendingAction = useRef<NavigationAction | undefined>(undefined);
  const leaveDialog = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const [hasLeaveDialog, setHasLeaveDialog] = useState(false);
  const leavePending = useRef(false);
  const mounted = useRef(true);
  const resultShown = useRef<string | undefined>(undefined);
  const resultDialog = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const { state } = session;
  const currentSessionId = useRef(state.snapshot?.id);
  currentSessionId.current = state.snapshot?.id;
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

  usePreventRemove(execution && !allowLeave && !selecting, ({ data }) => {
    if (state.phase === 'completed') {
      pendingAction.current = data.action;
      setAllowLeave(true);
      return;
    }
    if (leaveDialog.current) return;
    const sessionId = state.snapshot?.id;
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
      onBeforeClose: () => !mounted.current || !leavePending.current,
      onConfirm: async ({ preventClose }) => {
        if (
          !mounted.current ||
          leaveDialog.current !== dialog ||
          currentSessionId.current !== sessionId
        )
          return;
        if (leavePending.current) {
          preventClose();
          return;
        }
        leavePending.current = true;
        try {
          const left = await session.leave();
          if (!mounted.current || currentSessionId.current !== sessionId)
            return;
          if (left === false) {
            Toast.warning({
              title: intl.formatMessage({
                id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
              }),
            });
            return;
          }
          pendingAction.current = data.action;
          setAllowLeave(true);
        } finally {
          leavePending.current = false;
        }
      },
      onClose: () => {
        if (leaveDialog.current === dialog) {
          leaveDialog.current = undefined;
          if (mounted.current) setHasLeaveDialog(false);
        }
      },
    });
    leaveDialog.current = dialog;
    setHasLeaveDialog(true);
  });
  useEffect(() => {
    if (
      (!isFocused || selecting || state.phase === 'completed') &&
      !leavePending.current
    )
      void leaveDialog.current?.close();
  }, [isFocused, selecting, state.phase]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void leaveDialog.current?.close();
      leaveDialog.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (allowLeave && pendingAction.current) {
      const action = pendingAction.current;
      pendingAction.current = undefined;
      continueRemoval(action);
    }
  }, [allowLeave, continueRemoval]);
  const showResult = useCallback(
    (details: boolean) => {
      if (!state.snapshot || resultDialog.current || leaveDialog.current)
        return;
      const dialog = Dialog.show({
        testID: 'dust-sweep-result-sheet',
        nativeSheet: true,
        showHeader: false,
        showFooter: false,
        disableDrag: true,
        contentContainerProps: { px: 0, pb: 0 },
        onClose: () => {
          if (resultDialog.current === dialog) resultDialog.current = undefined;
        },
        renderContent: (
          <DustSweepResultDialog
            state={state}
            details={details}
            onClose={() => {
              void dialog.close();
            }}
            onAgain={async () => {
              await dialog.close();
              sweepAgain();
            }}
          />
        ),
      });
      resultDialog.current = dialog;
    },
    [state, sweepAgain],
  );
  const onDetails = useCallback(
    () => showResult(state.phase !== 'completed'),
    [showResult, state.phase],
  );
  useEffect(() => {
    if (
      desktop ||
      !isFocused ||
      hasLeaveDialog ||
      state.phase !== 'completed' ||
      !state.snapshot ||
      resultShown.current === state.snapshot.id
    )
      return;
    resultShown.current = state.snapshot.id;
    showResult(false);
  }, [desktop, isFocused, hasLeaveDialog, state, showResult]);
  useEffect(() => {
    if (!isFocused || selecting) {
      void resultDialog.current?.close();
      resultDialog.current = undefined;
    }
  }, [isFocused, selecting]);
  useEffect(
    () => () => {
      void resultDialog.current?.close();
      resultDialog.current = undefined;
    },
    [desktop],
  );
  const onDone = useCallback(() => exit(), [exit]);
  return (
    <Page testID="dust-sweep-page" scrollEnabled={desktop}>
      <Page.Header
        title={title}
        headerTitle={renderHeaderTitle}
        headerShown={!desktop}
      />
      <Page.Body>
        {desktop ? (
          <YStack
            flex={1}
            width="100%"
            maxWidth={1048}
            alignSelf="center"
            pt={56}
            pb="$6"
            px={44}
          >
            <XStack height={28} alignItems="center" position="relative" mb={14}>
              <IconButton
                testID="dust-sweep-back"
                icon="ChevronLeftOutline"
                variant="tertiary"
                position="absolute"
                left={-44}
                mx={0}
                my={0}
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.global_back,
                })}
                onPress={onDone}
              />
              <SizableText size="$headingLg">{title}</SizableText>
            </XStack>
            <DustSweepNetworks desktop />
            <XStack
              mt={30}
              flex={1}
              alignItems="flex-start"
              gap="$6"
              position="relative"
            >
              <YStack width="54.8%" maxHeight="100%">
                <DustSweepSelection desktop />
              </YStack>
              <YStack flex={1}>
                <DustSweepSummary
                  desktop
                  onDone={onDone}
                  onDetails={onDetails}
                />
              </YStack>
              <Stack
                position="absolute"
                left="54.8%"
                x={-6}
                top={252}
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
                  desktop
                  running={isFocused && state.phase === 'running'}
                />
              </Stack>
            </XStack>
          </YStack>
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

export default function DustSweepPage() {
  const route =
    useRoute<RouteProp<{ DustSweep: IDustSweepRouteParams }, 'DustSweep'>>();
  const intl = useIntl();
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
      <Page.Header headerShown={false} />
      <DustSweepFlow component={DustSweepPageContent} />
    </DustSweepProvider>
  );
}
