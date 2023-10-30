import { memo, useState } from 'react';

import { Button, Dialog, Screen, Text, YStack } from '@onekeyhq/components';

import PasswordSetup from '../../components/Password/PasswordSetup';
import PasswordVerify from '../../components/Password/PasswordVerify';

const Swap = () => {
  console.log('swap');
  const [open, setOpen] = useState(false);
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <Button
          onPress={() => {
            Dialog.confirm({
              title: 'ConfirmPassword',
              renderContent: <PasswordSetup onSetupRes={(data) => {}} />,
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码设置弹窗
        </Button>
        <Button
          onPress={() => {
            Dialog.confirm({
              title: 'ConfirmPassword',
              renderContent: <PasswordVerify onVerifyRes={(data) => {}} />,
              showFooter: false,
            });
            // setOpen(!open);
          }}
        >
          密码验证弹窗
        </Button>
        {/* <Button>清除缓存密码</Button> */}
      </YStack>
    </Screen>
  );
};

export default memo(Swap);
