import { memo } from 'react';

import {
  ESwitchSize,
  Select,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import type { ISelectRenderTriggerProps } from '@onekeyhq/components/src/forms/Select/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export const ReactScanSetting = memo(() => {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();

  const enableReactScan = devSettings.settings?.enableReactScan ?? false;
  const showToolbar = devSettings.settings?.reactScanShowToolbar ?? true;
  const animationSpeed =
    devSettings.settings?.reactScanAnimationSpeed ?? 'fast';
  const trackUnnecessaryRenders =
    devSettings.settings?.reactScanTrackUnnecessaryRenders ?? true;

  return (
    <YStack>
      <YStack borderRadius="$2" overflow="hidden">
        <ListItem
          icon="LightBulbOutline"
          title="启用 React Scan"
          subtitle="实时高亮组件重渲染 (Web/Desktop)"
          onPress={() => {
            setDevSettings((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                enableReactScan: !enableReactScan,
              },
            }));
          }}
        >
          <Switch
            size={ESwitchSize.small}
            value={enableReactScan}
            onChange={(value: boolean) => {
              setDevSettings((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enableReactScan: value,
                },
              }));
              // Restart app after settings change
              setTimeout(() => {
                void backgroundApiProxy.serviceApp.restartApp();
              }, 300);
            }}
          />
        </ListItem>

        {enableReactScan ? (
          <>
            <ListItem.Separator />
            <ListItem
              title="显示工具栏"
              subtitle="在页面上显示 React Scan 工具栏"
            >
              <Switch
                size={ESwitchSize.small}
                value={showToolbar}
                onChange={(value: boolean) => {
                  setDevSettings((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      reactScanShowToolbar: value,
                    },
                  }));
                }}
              />
            </ListItem>

            <ListItem.Separator />
            <ListItem title="动画速度" subtitle="高亮动画的速度">
              <Stack>
                <Select
                  title="选择动画速度"
                  items={[
                    { label: 'Slow', value: 'slow' },
                    { label: 'Fast', value: 'fast' },
                    { label: 'Off', value: 'off' },
                  ]}
                  onChange={(value) => {
                    setDevSettings((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        reactScanAnimationSpeed: value,
                      },
                    }));
                  }}
                  value={animationSpeed}
                  renderTrigger={(props: ISelectRenderTriggerProps) => (
                    <SizableText size="$bodyLgMedium" color="$textSubdued">
                      {props.value?.toString() || 'fast'}
                    </SizableText>
                  )}
                />
              </Stack>
            </ListItem>

            <ListItem.Separator />
            <ListItem
              title="追踪不必要的重渲染"
              subtitle="检测并标记不必要的组件重渲染"
            >
              <Switch
                size={ESwitchSize.small}
                value={trackUnnecessaryRenders}
                onChange={(value: boolean) => {
                  setDevSettings((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      reactScanTrackUnnecessaryRenders: value,
                    },
                  }));
                }}
              />
            </ListItem>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
});

ReactScanSetting.displayName = 'ReactScanSetting';
