import { memo, useCallback, useMemo } from 'react';

import { isObject } from 'lodash';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  IconButton,
  SizableText,
  Slider,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useDevSettingsPersistAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITabMeParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

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

  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();

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
                  await backgroundApiProxy.servicePassword.lockApp();
                } else {
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();
                  await backgroundApiProxy.servicePassword.lockApp();
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
