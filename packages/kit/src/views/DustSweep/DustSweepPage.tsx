import { useCallback, useEffect, useRef, useState } from 'react';

import { usePreventRemove, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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
import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { getDustSweepPresentation } from './stateMachine';

import type { NavigationAction, RouteProp } from '@react-navigation/core';

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
  if (showDetails)
    return (
      <DustSweepDetails
        state={state}
        onBack={() => setShowDetails(false)}
        onDone={onClose}
      />
    );
  return (
    <DustSweepResult
      state={state}
      onDetails={() => setShowDetails(true)}
      onAgain={state.phase === 'completed' ? onAgain : onClose}
    />
  );
}

function DustSweepPageContent() {
  const { session, selecting, sweepAgain, isFocused } = useDustSweep();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();
  const desktop = !platformEnv.isNative && media.gtMd;
  const [allowLeave, setAllowLeave] = useState(false);
  const pendingAction = useRef<NavigationAction | undefined>(undefined);
  const leaveDialog = useRef(false);
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
    !allowLeave && !selecting && state.phase !== 'completed',
    ({ data }) => {
      if (leaveDialog.current) return;
      leaveDialog.current = true;
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.sweep_leave_dust_sweep_confirmation,
        }),
        description: intl.formatMessage({
          id: ETranslations.sweep_leave_dust_sweep_warning,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.sweep_leave_dust_sweep,
        }),
        confirmButtonProps: { testID: 'dust-sweep-confirm-leave' },
        tone: 'destructive',
        onConfirm: async () => {
          await session.leave();
          pendingAction.current = data.action;
          setAllowLeave(true);
        },
        onClose: () => {
          leaveDialog.current = false;
        },
      });
    },
  );
  useEffect(() => {
    if (allowLeave && pendingAction.current)
      navigation.dispatch(pendingAction.current);
  }, [allowLeave, navigation]);
  const showResult = useCallback(
    (details: boolean) => {
      if (!state.snapshot || resultDialog.current) return;
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
  const onDetails = useCallback(() => showResult(true), [showResult]);
  useEffect(() => {
    if (
      desktop ||
      !isFocused ||
      state.phase !== 'completed' ||
      !state.snapshot ||
      resultShown.current === state.snapshot.id
    )
      return;
    resultShown.current = state.snapshot.id;
    showResult(false);
  }, [desktop, isFocused, state, showResult]);
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
  const onDone = useCallback(() => navigation.pop(), [navigation]);
  return (
    <Page testID="dust-sweep-page">
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
            maxWidth={960}
            alignSelf="center"
            pt={56}
            pb="$6"
            px="$0"
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
                <Icon name="ArrowRightOutline" size="$5" color="$iconSubdued" />
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
              <Icon name="ArrowBottomOutline" size="$5" color="$iconSubdued" />
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
      <DustSweepPageContent />
    </DustSweepProvider>
  );
}
