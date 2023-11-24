import { Suspense } from 'react';

import { useTheme } from 'tamagui';

import {
  Button,
  Dialog,
  Spinner,
  Text,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPasswordRes } from '@onekeyhq/kit-bg/src/services/ServicePassword';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import BiologyAuthSwitchContainer from '../../../components/BiologyAuthComponent/container/BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from '../../../components/BiologyAuthComponent/container/WebAuthSwitchContainer';
import PasswordSetupContainer from '../../../components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '../../../components/Password/container/PasswordUpdateContainer';

import { Layout } from './utils/Layout';

const PasswordDemoGallery = () => {
  const theme = useTheme();
  console.log(theme);
  const handlePasswordVerify = async () => {
    try {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.promptPasswordVerify() as Promise<IPasswordRes>);
      console.log('data', data);
      if (status === EPasswordResStatus.PASS_STATUS) {
        Toast.success({ title: '验证成功' });
      }
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const errorMessage = e?.message;
      if (errorMessage) {
        Toast.error({ title: errorMessage });
      }
    }
  };
  return (
    <Layout
      description=""
      suggestions={['']}
      boundaryConditions={['']}
      elements={[
        {
          title: 'Native',
          element: (
            <YStack space="$2" justifyContent="center">
              <Button
                onPress={async () => {
                  const checkPasswordSet =
                    await backgroundApiProxy.servicePassword.checkPasswordSet();
                  if (checkPasswordSet) {
                    await handlePasswordVerify();
                  } else {
                    const dialog = Dialog.confirm({
                      title: 'SetupPassword',
                      renderContent: (
                        <PasswordSetupContainer
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
                  }
                  // setOpen(!open);
                }}
              >
                密码设置弹窗
              </Button>
              <Button
                onPress={async () => {
                  const dialog = Dialog.confirm({
                    title: 'UpdatePassword',
                    renderContent: (
                      <PasswordUpdateContainer
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
                }}
              >
                密码修改弹窗
              </Button>
              <Button onPress={handlePasswordVerify}>密码验证弹窗</Button>
              <XStack justifyContent="space-between">
                <Text>生物识别</Text>
                <Suspense fallback={<Spinner size="large" />}>
                  <BiologyAuthSwitchContainer />
                </Suspense>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>Chrome生物识别</Text>
                <Suspense fallback={<Spinner size="large" />}>
                  <WebAuthSwitchContainer />
                </Suspense>
              </XStack>
              <Button
                onPress={async () => {
                  try {
                    const res =
                      await backgroundApiProxy.servicePassword.verifyWebAuth();
                    Toast.success({ title: res ? '解锁成功' : '请输入密码' });
                  } catch (e) {
                    console.log('e', e);
                  }
                }}
              >
                验证 Chrome生物识别
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default PasswordDemoGallery;
