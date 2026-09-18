import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';

import { DustSweepProgress } from './components/DustSweepProgress';
import { DustSweepSelection } from './components/DustSweepSelection';
import { useDustSweepCandidates } from './hooks/useDustSweepCandidates';
import { useDustSweepExecution } from './hooks/useDustSweepExecution';
import {
  dustSweepReducer,
  getDustSweepProgress,
  getDustSweepSelectionSummary,
  initialDustSweepSession,
} from './stateMachine';

const DEFAULT_SLIPPAGE = 5;
const SLIPPAGE_PRESETS = [5, 10, 20];

function DustSweepEmpty({ networkName }: { networkName?: string }) {
  const intl = useIntl();
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      px="$8"
    >
      <Icon name="ControllerRoundUpSolid" size="$10" color="$iconSubdued" />
      <SizableText size="$headingMd" textAlign="center">
        {intl.formatMessage(
          {
            id: ETranslations.sweep_no_small_balances_on_network,
          },
          { network: networkName ?? '' },
        )}
      </SizableText>
      <SizableText color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.sweep_try_different_network_or_amount_range,
        })}
      </SizableText>
    </YStack>
  );
}

export function DustSweepPage() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { gtMd } = useMedia();
  const {
    candidates,
    targetToken,
    loading,
    error,
    generation,
    account,
    network,
  } = useDustSweepCandidates();
  const [state, dispatch] = useReducer(
    dustSweepReducer,
    initialDustSweepSession,
  );
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [amountRange, setAmountRange] = useState(10);
  const hydratedGeneration = useRef<string | undefined>(undefined);
  const executionKeyRef = useRef<string | undefined>(undefined);
  const execute = useDustSweepExecution();

  useEffect(() => {
    if (state.stage !== 'selecting' || loading) return;
    const hydrateKey = `${generation}:${amountRange}`;
    if (hydratedGeneration.current === hydrateKey) return;
    hydratedGeneration.current = hydrateKey;
    dispatch({
      type: 'hydrate',
      candidates: candidates.filter(
        (candidate) => Number(candidate.fiatValue || 0) < amountRange,
      ),
      generation,
      accountId: account?.id,
      networkId: network?.id,
    });
  }, [
    account?.id,
    amountRange,
    candidates,
    generation,
    loading,
    network?.id,
    state.stage,
  ]);

  const summary = getDustSweepSelectionSummary(state);
  const selectedItems = useMemo(
    () => state.items.filter((item) => state.selectedKeys.includes(item.key)),
    [state.items, state.selectedKeys],
  );

  useEffect(() => {
    if (state.stage === 'preparing') {
      const first = selectedItems[0];
      if (first) dispatch({ type: 'begin_item', key: first.key });
      return;
    }
    if (state.stage !== 'running') return;
    const current = selectedItems[state.activeIndex];
    if (!current || !state.targetToken) return;
    if (current.status === 'waiting') {
      dispatch({ type: 'begin_item', key: current.key });
      return;
    }
    if (current.status !== 'running' || executionKeyRef.current === current.key)
      return;
    executionKeyRef.current = current.key;
    void execute({
      item: current,
      targetToken: state.targetToken,
      accountId: account?.id ?? '',
      userAddress: account?.addressDetail?.address ?? '',
      slippagePercentage: slippage,
    })
      .then((result) => {
        dispatch({ type: 'broadcast_item', key: current.key });
        dispatch({
          type: 'settle_item',
          key: current.key,
          receivedAmount: result.receivedAmount,
        });
        executionKeyRef.current = undefined;
      })
      .catch((executionError: unknown) => {
        const reason =
          executionError instanceof Error
            ? executionError.message
            : String(executionError);
        const canSkip = /slippage|price impact|no quote|unsupported/.test(
          reason.toLowerCase(),
        );
        dispatch({
          type: canSkip ? 'skip_item' : 'fail_item',
          key: current.key,
          reason,
        });
        executionKeyRef.current = undefined;
      });
  }, [
    account?.addressDetail?.address,
    account?.id,
    execute,
    selectedItems,
    slippage,
    state.activeIndex,
    state.stage,
    state.targetToken,
    state,
  ]);

  const handleLeave = useCallback(() => {
    if (
      state.stage === 'selecting' ||
      state.stage === 'completed' ||
      state.stage === 'left'
    ) {
      navigation.pop();
      return;
    }
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.sweep_leave_dust_sweep }),
      description: intl.formatMessage({
        id: ETranslations.sweep_leave_dust_sweep_confirmation,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_exit }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirm: () => {
        dispatch({ type: 'leave' });
        navigation.pop();
      },
    });
  }, [intl, navigation, state.stage]);

  const handleStart = useCallback(() => {
    if (!targetToken) return;
    dispatch({ type: 'start', targetToken });
  }, [targetToken]);

  let body = (
    <DustSweepSelection
      state={state}
      summary={summary}
      targetToken={targetToken}
      desktop={gtMd}
      slippage={slippage}
      amountRange={amountRange}
      intl={intl}
      onToggleAll={() => dispatch({ type: 'toggle_all' })}
      onToggle={(key) => dispatch({ type: 'toggle', key })}
      onAddHidden={() => dispatch({ type: 'add_hidden' })}
      onChangeAmountRange={setAmountRange}
      onChangeSlippage={() =>
        setSlippage(
          (value) =>
            SLIPPAGE_PRESETS[
              (SLIPPAGE_PRESETS.indexOf(value) + 1) % SLIPPAGE_PRESETS.length
            ],
        )
      }
      onStart={handleStart}
    />
  );
  if (loading) {
    body = (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    );
  } else if (error) {
    body = (
      <YStack flex={1} alignItems="center" justifyContent="center" px="$5">
        <SizableText color="$red11">{error.message}</SizableText>
      </YStack>
    );
  } else if (!state.items.length) {
    body = <DustSweepEmpty networkName={network?.name} />;
  } else if (
    state.stage === 'preparing' ||
    state.stage === 'running' ||
    state.stage === 'paused'
  ) {
    body = (
      <DustSweepProgress
        state={state}
        onPause={() => dispatch({ type: 'pause' })}
        onResume={() => dispatch({ type: 'resume' })}
      />
    );
  } else if (state.stage === 'completed') {
    const progress = getDustSweepProgress(state);
    body = (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$4"
        px="$5"
      >
        <Icon name="CheckmarkSolid" size="$12" color="$green11" />
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.title_dust_swept })}
        </SizableText>
        <SizableText color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.sweep_you_receive })}{' '}
          {state.receivedAmount} {targetToken?.symbol ?? ''}
        </SizableText>
        <SizableText color="$textSubdued">
          {progress.success} converted · {progress.skipped} skipped
        </SizableText>
        <XStack gap="$3">
          <Button
            testID="dust-sweep-again"
            variant="secondary"
            onPress={() => dispatch({ type: 'reset' })}
          >
            {intl.formatMessage({ id: ETranslations.sweep_sweep_again })}
          </Button>
          <Button testID="dust-sweep-done" onPress={() => navigation.pop()}>
            Done
          </Button>
        </XStack>
      </YStack>
    );
  }

  const renderHeaderLeft = useCallback(
    () => (
      <IconButton
        testID="dust-sweep-back"
        icon="ChevronLeftOutline"
        variant="tertiary"
        onPress={handleLeave}
      />
    ),
    [handleLeave],
  );

  return (
    <Page safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.title_dust_sweep })}
        headerLeft={renderHeaderLeft}
      />
      <Page.Body>
        <Stack
          flex={1}
          maxWidth={gtMd ? 960 : undefined}
          alignSelf="center"
          width="100%"
        >
          {body}
        </Stack>
      </Page.Body>
    </Page>
  );
}
