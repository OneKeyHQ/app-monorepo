import { Suspense } from 'react';

import {
  Button,
  Dialog,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import BiologyAuthSwitchContainer from '../../../../../../components/BiologyAuthComponent/container/BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from '../../../../../../components/BiologyAuthComponent/container/WebAuthSwitchContainer';
import PasswordSetupContainer from '../../../../../../components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '../../../../../../components/Password/container/PasswordUpdateContainer';

import { Layout } from './utils/Layout';

const PasswordDemoGallery = () => {
  const theme = useTheme();
  console.log(theme);
  const handlePasswordVerify = async () => {
    const { status, password } =
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
    if (status === EPasswordResStatus.PASS_STATUS) {
      // get password success
      console.log('password', password);
      Toast.success({ title: '验证成功' });
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
                    await backgroundApiProxy.servicePassword.isPasswordSet();
                  if (checkPasswordSet) {
                    await handlePasswordVerify();
                  } else {
                    const dialog = Dialog.show({
                      title: 'SetupPassword',
                      renderContent: (
                        <PasswordSetupContainer
                          onSetupRes={async (data) => {
                            console.log('setup data', data);
                            if (data) {
                              await dialog.close();
                              Toast.success({ title: '设置成功' });
                              void dialog.close();
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
                  const dialog = Dialog.show({
                    title: 'UpdatePassword',
                    estimatedContentHeight: 100,
                    renderContent: (
                      <PasswordUpdateContainer
                        onUpdateRes={async (data) => {
                          console.log('update data', data);
                          if (data) {
                            await dialog.close();
                            Toast.success({ title: '修改成功' });
                            void dialog.close();
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
                <SizableText>生物识别</SizableText>
                <Suspense fallback={<Spinner size="large" />}>
                  <BiologyAuthSwitchContainer />
                </Suspense>
              </XStack>
              <XStack justifyContent="space-between">
                <SizableText>Chrome生物识别</SizableText>
                <Suspense fallback={<Spinner size="large" />}>
                  <WebAuthSwitchContainer />
                </Suspense>
              </XStack>
              <Button
                onPress={async () => {
                  try {
                    const res =
                      await backgroundApiProxy.servicePassword.verifyPassword({
                        password: '',
                        isWebAuth: true,
                      });
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
