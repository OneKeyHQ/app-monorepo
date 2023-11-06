import { Suspense, memo } from 'react';

import {
  Button,
  Dialog,
  Screen,
  Spinner,
  Text,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import BiologyAuthSwitch from '../../components/BiologyAuthComponent/BiologyAuthSwitch';
import PasswordSetup from '../../components/Password/PasswordSetup';
import PasswordUpdate from '../../components/Password/PasswordUpdate';
import PasswordVerify from '../../components/Password/PasswordVerify';

const Swap = () => {
  console.log('swap');

  const [settings] = useSettingsAtom();
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <Button
          onPress={() => {
            if (settings.isPasswordSet) {
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
                <Suspense fallback={<Spinner size="large" />}>
                  <PasswordVerify
                    onVerifyRes={(data) => {
                      console.log('verify data', data);
                      if (data) {
                        Toast.success({ title: '验证成功' });
                        dialog.close();
                      }
                    }}
                  />
                </Suspense>
              ),
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码验证弹窗
        </Button>
        <XStack justifyContent="space-between">
          <Text>生物识别</Text>
          <Suspense fallback={<Spinner size="large" />}>
            <BiologyAuthSwitch />
          </Suspense>
        </XStack>
      </YStack>
    </Screen>
  );
};

export default memo(Swap);
