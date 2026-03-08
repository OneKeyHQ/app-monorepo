import { memo, useCallback, useMemo } from 'react';

import { isObject } from 'lodash';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  IconButton,
  Input,
  SizableText,
  Slider,
  Stack,
  Switch,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useDevSettingsPersistAtom,
  usePasswordPersistAtom,
  usePerpsCandlesWebviewMountedAtom,
  usePerpsWebSocketDataUpdateTimesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function DevPerpsWebSocketUpdateView() {
  const [{ wsDataReceiveTimes, wsDataUpdateTimes }, setWsDataUpdateTimes] =
    usePerpsWebSocketDataUpdateTimesAtom();
  const [{ mounted }] = usePerpsCandlesWebviewMountedAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled || !devSettings.settings?.showPerpsRenderStats) {
    return null;
  }

  return (
    <YStack maxWidth="$80">
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <XStack>
          <SizableText>PerpWS 接收: </SizableText>
          <SizableText>{wsDataReceiveTimes}</SizableText>
        </XStack>
        <XStack>
          <SizableText>PerpWS 刷新: </SizableText>
          <SizableText>{wsDataUpdateTimes}</SizableText>
        </XStack>
        <XStack>
          <SizableText>K 线挂载: </SizableText>
          <SizableText>{mounted ? '是' : '--'}</SizableText>
        </XStack>
      </XStack>
      <Button
        onPress={() => {
          setWsDataUpdateTimes((v) => ({
            ...v,
            wsDataReceiveTimes: 0,
            wsDataUpdateTimes: 0,
          }));
        }}
      >
        重置计数
      </Button>
    </YStack>
  );
}

function DevOverlayWindow() {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();
  const devOverlayWindow =
    devSettings.enabled && devSettings.settings?.showDevOverlayWindow;
  const positionInfo = useMemo(() => {
    if (isObject(devOverlayWindow)) {
      return devOverlayWindow;
    }
    return {
      top: 10,
      align: 'right',
    };
  }, [devOverlayWindow]);

  const navigation = useAppNavigation<IPageNavigationProp<any>>();

  const [passwordSetting] = usePasswordPersistAtom();

  const updateTopPosition = useThrottledCallback((value: number) => {
    setDevSettings((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showDevOverlayWindow: {
          align:
            (isObject(prev.settings?.showDevOverlayWindow)
              ? prev.settings?.showDevOverlayWindow?.align
              : 'right') || 'right',
          top: value,
        },
      },
    }));
  }, 100);

  const updateAlign = useDebouncedCallback((value: 'left' | 'right') => {
    setDevSettings((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showDevOverlayWindow: {
          ...(isObject(prev.settings?.showDevOverlayWindow)
            ? prev.settings?.showDevOverlayWindow
            : { top: 10 }),
          align: value,
        },
      },
    }));
  }, 100);

  const handlePress = useCallback(() => {
    const dialog = Dialog.show({
      title: 'DevOverlayWindow',
      showConfirmButton: false,
      showCancelButton: false,
      renderContent: (
        <YStack gap="$4">
          <XStack gap="$2">
            <Button
              onPress={() => {
                navigation.pushModal(EModalRoutes.SettingModal, {
                  screen: EModalSettingRoutes.SettingListModal,
                });
                void dialog.close();
              }}
              testID="open-settings-page"
            >
              Settings
            </Button>
            <Button
              onPress={() => {
                navigation.switchTab(ETabRoutes.Home);
                void dialog.close();
              }}
              testID="open-home-page"
            >
              Home
            </Button>
            <Button
              onPress={async () => {
                if (passwordSetting.isPasswordSet) {
                  await backgroundApiProxy.servicePassword.lockApp({
                    manual: true,
                  });
                } else {
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();
                  await backgroundApiProxy.servicePassword.lockApp({
                    manual: true,
                  });
                }
                void dialog.close();
              }}
            >
              Lock
            </Button>
          </XStack>

          <XStack gap="$2" alignItems="center">
            <SizableText>TOP</SizableText>
            <Stack flex={1}>
              <Slider
                min={1}
                max={100}
                step={1}
                defaultValue={positionInfo.top}
                onChange={(v) => {
                  updateTopPosition(v);
                }}
              />
            </Stack>
          </XStack>

          <XStack gap="$2" alignItems="center">
            <SizableText>ALIGN</SizableText>
            <Button
              size="small"
              onPress={() => {
                updateAlign('left');
              }}
            >
              Left
            </Button>
            <Button
              size="small"
              onPress={() => {
                updateAlign('right');
              }}
            >
              Right
            </Button>
          </XStack>

          <YStack gap="$2">
            <XStack gap="$2" alignItems="center">
              <SizableText
                size="$headingLg"
                onPress={() => {
                  console.log(dbPerfMonitor.getSettings());
                }}
              >
                DB Perf Monitor
              </SizableText>
              <Stack flex={1} />
              <Button
                size="small"
                onPress={() => {
                  dbPerfMonitor.resetAllData();
                }}
              >
                重置统计数据
              </Button>
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Tooltip
                renderTrigger={<SizableText>告警</SizableText>}
                renderContent={
                  <SizableText>
                    告警开启后，统计数据每隔 3 秒自动重置
                  </SizableText>
                }
              />
              <Switch
                isUncontrolled
                defaultChecked={
                  dbPerfMonitor.getSettings()?.toastWarningEnabled
                }
                onChange={(v) => {
                  dbPerfMonitor.updateSettings({
                    toastWarningEnabled: v,
                  });
                }}
              />
              <Stack flex={1} />
              <Tooltip
                renderTrigger={<SizableText>告警阈值</SizableText>}
                renderContent={
                  <SizableText>
                    当数据库调用频率超过阈值后 Toast 告警
                  </SizableText>
                }
              />
              <Input
                addOns={[
                  {
                    label: '次/3秒',
                  },
                ]}
                size="small"
                width={50}
                defaultValue={dbPerfMonitor
                  .getSettings()
                  ?.toastWarningSize.toString()}
                onChangeText={(v) => {
                  const value = Number(v);
                  if (Number.isNaN(value)) {
                    return;
                  }
                  dbPerfMonitor.updateSettings({
                    toastWarningSize: value,
                  });
                }}
              />
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Tooltip
                renderTrigger={<SizableText>实时日志</SizableText>}
                renderContent={
                  <SizableText>
                    开启数据库调用统计数据的实时日志，关闭后仅打印告警日志
                  </SizableText>
                }
              />
              <Switch
                isUncontrolled
                defaultChecked={dbPerfMonitor.getSettings()?.consoleLogEnabled}
                onChange={(v) => {
                  dbPerfMonitor.updateSettings({
                    consoleLogEnabled: v,
                  });
                }}
              />
              <Stack flex={1} />
              <Tooltip
                renderTrigger={<SizableText>自动断点</SizableText>}
                renderContent={
                  <SizableText>
                    需代码中先配置 DebuggerRule, 当满足规则时自动断点,
                    方便排查函数调用栈
                  </SizableText>
                }
              />
              <Switch
                isUncontrolled
                defaultChecked={dbPerfMonitor.getSettings()?.debuggerEnabled}
                onChange={(v) => {
                  dbPerfMonitor.updateSettings({
                    debuggerEnabled: v,
                  });
                }}
              />
            </XStack>
          </YStack>

          <DevPerpsWebSocketUpdateView />
        </YStack>
      ),
    });
  }, [
    positionInfo.top,
    navigation,
    passwordSetting.isPasswordSet,
    updateTopPosition,
    updateAlign,
  ]);

  if (!devOverlayWindow) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      left={positionInfo.align === 'left' ? 0 : undefined}
      right={positionInfo.align === 'right' ? 0 : undefined}
      top={`${positionInfo.top > 95 ? 95 : positionInfo.top}%`}
      zIndex={DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX}
    >
      <IconButton
        size="small"
        testID="dev-button"
        icon="BugSolid"
        iconProps={{
          // color: '$iconCritical',
          color: '$iconSuccess',
        }}
        backgroundColor="$bgSuccess"
        onPress={handlePress}
      />
      {/* <Icon name="BugSolid" color="$iconSuccess" /> */}
    </Stack>
  );
}

export default memo(DevOverlayWindow);
