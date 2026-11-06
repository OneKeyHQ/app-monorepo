import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState, NativeModules } from 'react-native';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ILiveActivityStatus = {
  enabled: boolean;
  activities: { id: string; state: string; progress: number }[];
};

type ILiveActivityDemoModule = {
  getStatus: () => Promise<ILiveActivityStatus>;
  start: () => Promise<ILiveActivityStatus>;
  update: (id: string) => Promise<ILiveActivityStatus>;
  end: () => Promise<ILiveActivityStatus>;
};

const nativeModule = platformEnv.isNativeIOS
  ? (NativeModules.LiveActivityDemo as ILiveActivityDemoModule | undefined)
  : undefined;

export function LiveActivityDemo() {
  const [status, setStatus] = useState<ILiveActivityStatus>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const run = useCallback(
    async (operation: () => Promise<ILiveActivityStatus>) => {
      if (pending.current) {
        return;
      }
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        setStatus(await operation());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus(undefined);
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (nativeModule) {
      await run(() => nativeModule.getStatus());
    }
  }, [run]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const activity = status?.activities[0];

  if (!nativeModule) {
    return (
      <SizableText testID="live-activity-unavailable">
        {platformEnv.isNativeIOS
          ? 'This native build does not include the Live Activity demo. Install the new test build.'
          : 'Live Activity testing is available on iOS only.'}
      </SizableText>
    );
  }

  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd">
        Local demo only. No transaction or push notification is sent.
      </SizableText>
      <SizableText testID="live-activity-status">
        {status
          ? `Live Activities: ${status.enabled ? 'enabled' : 'disabled'} · Active demos: ${status.activities.length}`
          : 'Status unavailable. Tap Refresh status.'}
      </SizableText>
      {activity ? (
        <SizableText testID="live-activity-progress" selectable>
          {`${activity.state} · ${activity.progress}%\nID: ${activity.id}`}
        </SizableText>
      ) : null}
      {error ? (
        <SizableText color="$textCritical" testID="live-activity-error">
          {error}
        </SizableText>
      ) : null}
      <XStack gap="$2" flexWrap="wrap">
        <Button
          testID="live-activity-start"
          disabled={busy || !status?.enabled || !!activity}
          onPress={() => run(() => nativeModule.start())}
        >
          Start demo
        </Button>
        <Button
          testID="live-activity-update"
          disabled={busy || !activity || activity.progress >= 100}
          onPress={async () => {
            if (activity) {
              await run(() => nativeModule.update(activity.id));
            }
          }}
        >
          Update +25%
        </Button>
        <Button
          testID="live-activity-end"
          disabled={busy || !activity}
          onPress={() => run(() => nativeModule.end())}
        >
          End demo
        </Button>
        <Button
          testID="live-activity-refresh"
          disabled={busy}
          onPress={refresh}
        >
          Refresh status
        </Button>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        Start in the foreground, then lock the phone or return to the Home
        Screen. On a supported iPhone, long-press the Dynamic Island to expand
        it. Return here to update the progress, then check both surfaces again.
        End demo should remove it from both surfaces. Closing this panel keeps
        the demo running.
      </SizableText>
    </YStack>
  );
}
