import { memo, useState } from 'react';

import { XStack } from 'tamagui';

import {
  Button,
  Dialog,
  Screen,
  Switch,
  Text,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import PasswordSetup from '../../components/Password/PasswordSetup';
import PasswordUpdate from '../../components/Password/PasswordUpdate';
import PasswordVerify from '../../components/Password/PasswordVerify';
import useBiologyAuth from '../../hooks/useBiologyAuthSettings';

const Swap = () => {
  console.log('swap');
  const { isSupportBiologyAuth, enableBiologyAuth, setBiologyAuthEnable } =
    useBiologyAuth();
  const [settings] = useSettingsAtom();
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <Button
          onPress={() => {
            if (settings.passwordSet) {
              Toast.error({ title: '已设置密码' });
              return;
            }
            const dialog = Dialog.confirm({
              title: 'SetupPassword',
              renderContent: (
                <PasswordSetup
                  onSetupRes={(data) => {
                    console.log('setup data', data);
                    if (data) {
                      Toast.success({ title: '设置成功' });
                      dialog.close();
                    }
                  }}
                />
              ),
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码设置弹窗
        </Button>
        <Button
          onPress={() => {
            const dialog = Dialog.confirm({
              title: 'UpdatePassword',
              renderContent: (
                <PasswordUpdate
                  onUpdateRes={(data) => {
                    console.log('update data', data);
                    if (data) {
                      Toast.success({ title: '修改成功' });
                      dialog.close();
                    }
                  }}
                />
              ),
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码修改弹窗
        </Button>
        <Button
          onPress={() => {
            const dialog = Dialog.confirm({
              title: 'ConfirmPassword',
              renderContent: (
                <PasswordVerify
                  onVerifyRes={(data) => {
                    console.log('verify data', data);
                    if (data) {
                      Toast.success({ title: '验证成功' });
                      dialog.close();
                    }
                  }}
                />
              ),
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码验证弹窗
        </Button>
        {isSupportBiologyAuth && (
          <XStack>
            <Switch
              value={enableBiologyAuth}
              onChange={(checked) => {
                void setBiologyAuthEnable(checked);
              }}
            />
            <Text>生物识别开关</Text>
          </XStack>
        )}
      </YStack>
    </Screen>
  );
};

export default memo(Swap);
