import { memo, useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Select,
  Slider,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITabMeParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

function DevOverlayWindow() {
  const [position, setPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  }>({
    top: 10,
    right: 0,
    left: undefined,
  });

  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();

  const [passwordSetting] = usePasswordPersistAtom();

  const handlePress = useCallback(() => {
    const dialog = Dialog.confirm({
      title: 'Dev Menu',
      onConfirm: async ({ getForm }) => {
        const form = getForm();
        const values = form?.getValues();
        setPosition({
          top: values?.top,
          left: values?.align === 'left' ? 0 : undefined,
          right: values?.align === 'right' ? 0 : undefined,
        });
      },
      renderContent: (
        <Dialog.Form
          formProps={{
            values: {
              top: position.top,
              align: position.left !== undefined ? 'left' : 'right',
            },
          }}
        >
          <YStack gap="$6">
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
              Lock Now
            </Button>
            <Dialog.FormField name="top" label="Top">
              <Slider min={1} max={100} step={1} />
            </Dialog.FormField>

            <Dialog.FormField name="align" label="align">
              <Select
                items={[
                  {
                    value: 'left',
                    label: 'left',
                  },
                  {
                    value: 'right',
                    label: 'right',
                  },
                ]}
                title="Align"
              />
            </Dialog.FormField>
          </YStack>
        </Dialog.Form>
      ),
    });
  }, [navigation, passwordSetting.isPasswordSet, position.left, position.top]);

  return (
    <Stack position="absolute" {...position} top={`${position.top}%`}>
      <Button
        circular
        icon="CodeOutline"
        alignContent="center"
        justifyContent="center"
        onPress={handlePress}
        testID="dev-button"
      />
    </Stack>
  );
}

export default memo(DevOverlayWindow);
