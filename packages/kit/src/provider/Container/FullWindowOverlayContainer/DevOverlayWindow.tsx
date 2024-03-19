import { memo, useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Dialog, Stack, YStack } from '@onekeyhq/components';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ETabRoutes } from '../../../routes/Tab/type';

import type { ITabMeParamList } from '../../../routes/Tab/Me/type';

function DevOverlayWindow() {
  const [position, setPosition] = useState<{
    top: string;
    left?: number;
    right?: number;
  }>({
    top: '10%',
    left: 0,
  });

  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();

  const handlePress = useCallback(() => {
    const dialog = Dialog.cancel({
      title: 'Dev Menu',
      renderContent: (
        <YStack space="$6">
          <Button
            onPress={() => {
              navigation.pushModal(EModalRoutes.SettingModal, {
                screen: EModalSettingRoutes.SettingListModal,
              });
              void dialog.close();
            }}
            testID="open-settings-page"
          >
            Open Settings page
          </Button>
          <Button
            onPress={() => {
              navigation.switchTab(ETabRoutes.Home);
              void dialog.close();
            }}
            testID="open-home-page"
          >
            Open home page
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, top: '10%' }));
              void dialog.close();
            }}
          >
            Top: 10%
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, top: '30%' }));
              void dialog.close();
            }}
          >
            Top: 30%
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, top: '60%' }));
              void dialog.close();
            }}
          >
            Top: 60%
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, top: '90%' }));
              void dialog.close();
            }}
          >
            Top: 90%
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, left: 0, right: undefined }));
              void dialog.close();
            }}
          >
            Align Left
          </Button>
          <Button
            onPress={() => {
              setPosition((state) => ({ ...state, right: 0, left: undefined }));
              void dialog.close();
            }}
          >
            Align Right
          </Button>
        </YStack>
      ),
    });
  }, [navigation]);

  return (
    <Stack position="absolute" {...position}>
      <Button
        circular
        icon="MenuSolid"
        alignContent="center"
        justifyContent="center"
        onPress={handlePress}
        testID="dev-button"
      />
    </Stack>
  );
}

export default memo(DevOverlayWindow);
