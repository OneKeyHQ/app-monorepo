import { useCallback, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  ILiveActivityInstance,
  ILiveActivityMockScenario,
  ILiveActivityStatus,
} from '@onekeyhq/shared/types/liveActivity';

const scenarios: ILiveActivityMockScenario[] = [
  'success',
  'refund',
  'failed',
  'canceled',
  'almostDone',
  'longTicker',
];
const states: ILiveActivityStatus[] = [
  'confirming',
  'swapping',
  'receiving',
  'done',
  'refunding',
  'refunded',
  'failed',
  'canceled',
];

export function SwapLiveActivityMockDetail({
  activity,
}: {
  activity: ILiveActivityInstance;
}) {
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceLiveActivity.getStatus(),
    [],
    { pollingInterval: 1000, revalidateOnFocus: true, checkIsFocused: false },
  );
  const current =
    result?.activities.find(
      (item) => item.order.orderKey === activity.order.orderKey,
    ) ?? activity;
  return (
    <YStack gap="$3">
      <SizableText size="$headingMd">Mock swap order</SizableText>
      <SizableText color="$textSubdued">
        Synthetic data · no funds or transaction
      </SizableText>
      <SizableText>{`${current.order.fromToken.symbol} → ${current.order.toToken.symbol}`}</SizableText>
      <SizableText>{`Status: ${current.content.status}`}</SizableText>
      <SizableText>{`Fixed ETA: ${new Date(current.order.estimatedEndAtMs).toISOString()}`}</SizableText>
      <SizableText selectable>{current.order.orderKey}</SizableText>
    </YStack>
  );
}

export function showSwapLiveActivityMockDetail(
  activity: ILiveActivityInstance,
) {
  Dialog.cancel({
    title: 'Live Activity test order',
    renderContent: <SwapLiveActivityMockDetail activity={activity} />,
  });
}

export function showSwapLiveActivityPanel() {
  Dialog.cancel({
    title: 'BTC Swap Live Activity',
    renderContent: <SwapLiveActivityPanel />,
  });
}

export function SwapLiveActivityPanel() {
  const { result, run: refresh } = usePromiseResult(
    () => backgroundApiProxy.serviceLiveActivity.getStatus(),
    [],
    {
      pollingInterval: 1000,
      revalidateOnFocus: true,
      keepResultIfError: true,
      checkIsFocused: false,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const run = useCallback(
    async (operation: () => Promise<unknown>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        await operation();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const password = () => ({
    $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
  });
  const activity = result?.activities
    .filter((item) => item.order.isMock)
    .toSorted((a, b) => b.order.startedAtMs - a.order.startedAtMs)[0];
  return (
    <ScrollView maxHeight={600}>
      <YStack gap="$3">
        <SizableText size="$headingMd">BTC Swap · Live Activity</SizableText>
        <SizableText>
          Local mock · no transaction or production push
        </SizableText>
        <SizableText>{`Native: ${result?.supported ? 'available' : 'unavailable'} · permission: ${result?.enabled ? 'enabled' : 'disabled'} · cards: ${result?.activities.length ?? 0}`}</SizableText>
        <Button
          onPress={() =>
            (
              globalThis as typeof globalThis & {
                $onekeyPerfMonitor?: { hide: () => void };
              }
            ).$onekeyPerfMonitor?.hide()
          }
        >
          Hide performance HUD
        </Button>
        <Button
          disabled={busy}
          testID="swap-live-clear-top"
          onPress={() =>
            run(() =>
              backgroundApiProxy.serviceLiveActivity.clearMockScenarios(
                password(),
              ),
            )
          }
        >
          Clear mock cards
        </Button>
        <XStack gap="$2" flexWrap="wrap">
          {scenarios.map((scenario) => (
            <Button
              key={scenario}
              disabled={busy || !result?.enabled}
              testID={`swap-live-start-${scenario}`}
              onPress={() =>
                run(() =>
                  backgroundApiProxy.serviceLiveActivity.startMockScenario({
                    ...password(),
                    scenario,
                  }),
                )
              }
            >
              {scenario}
            </Button>
          ))}
          <Button
            disabled={busy || !result?.enabled}
            testID="swap-live-auto-success"
            onPress={() =>
              run(() =>
                backgroundApiProxy.serviceLiveActivity.startMockScenario({
                  ...password(),
                  scenario: 'success',
                  automatic: true,
                }),
              )
            }
          >
            Auto success · 10s steps
          </Button>
          <Button
            disabled={busy || !result?.enabled}
            testID="swap-live-auto-refund"
            onPress={() =>
              run(() =>
                backgroundApiProxy.serviceLiveActivity.startMockScenario({
                  ...password(),
                  scenario: 'refund',
                  automatic: true,
                }),
              )
            }
          >
            Auto refund · 10s steps
          </Button>
        </XStack>
        {activity ? (
          <YStack gap="$2">
            <SizableText
              selectable
            >{`${activity.order.fromToken.symbol} → ${activity.order.toToken.symbol} · ${activity.content.status}\n${activity.order.orderKey}`}</SizableText>
            <SizableText>{`JPush: ${activity.pushRegistration} · subscription: ${result?.subscriptions.find((item) => item.activityId === activity.activityId)?.status ?? 'pending'}`}</SizableText>
            <XStack gap="$2" flexWrap="wrap">
              {states.map((status) => (
                <Button
                  key={status}
                  disabled={busy}
                  testID={`swap-live-state-${status}`}
                  onPress={() =>
                    run(() =>
                      backgroundApiProxy.serviceLiveActivity.updateMockScenario(
                        {
                          ...password(),
                          orderKey: activity.order.orderKey,
                          status,
                        },
                      ),
                    )
                  }
                >
                  {status}
                </Button>
              ))}
            </XStack>
            <Button onPress={() => showSwapLiveActivityMockDetail(activity)}>
              View mock order
            </Button>
          </YStack>
        ) : null}
        {error ? (
          <SizableText color="$textCritical">{error}</SizableText>
        ) : null}
        <XStack gap="$2">
          <Button disabled={busy} onPress={() => run(refresh)}>
            Refresh
          </Button>
          <Button
            disabled={busy}
            testID="swap-live-clear"
            onPress={() =>
              run(() =>
                backgroundApiProxy.serviceLiveActivity.clearMockScenarios(
                  password(),
                ),
              )
            }
          >
            Clear mock cards
          </Button>
        </XStack>
        {result?.lastMockOrderKey ? (
          <XStack gap="$2" flexWrap="wrap">
            <Button
              disabled={busy}
              testID="swap-live-replay"
              onPress={() =>
                run(() =>
                  backgroundApiProxy.serviceLiveActivity.replayMockScenario({
                    ...password(),
                    orderKey: result.lastMockOrderKey ?? '',
                    operation: 'broadcast',
                  }),
                )
              }
            >
              Replay same broadcast
            </Button>
            <Button
              disabled={busy}
              testID="swap-live-complete-dismissed"
              onPress={() =>
                run(() =>
                  backgroundApiProxy.serviceLiveActivity.replayMockScenario({
                    ...password(),
                    orderKey: result.lastMockOrderKey ?? '',
                    operation: 'done',
                  }),
                )
              }
            >
              Complete last order
            </Button>
          </XStack>
        ) : null}
        <SizableText color="$textSubdued" size="$bodySm">
          Start in the foreground. Return Home for Compact, long-press the
          island for Expanded, and lock the phone for the lock-screen card. Two
          cards show Minimal. Closing this panel keeps cards running.
        </SizableText>
      </YStack>
    </ScrollView>
  );
}
