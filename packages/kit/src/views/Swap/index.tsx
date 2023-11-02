import { memo, useState } from 'react';

import { XStack } from 'tamagui';

import {
  Button,
  Dialog,
  Screen,
  Switch,
  Text,
  YStack,
} from '@onekeyhq/components';

import useBiologyAuth from '../../components/Password/hooks/useBiologyAuth';
import PasswordSetup from '../../components/Password/PasswordSetup';
import PasswordUpdate from '../../components/Password/PasswordUpdate';
import PasswordVerify from '../../components/Password/PasswordVerify';

const Swap = () => {
  console.log('swap');
  const { isSupportBiologyAuth, enableBiologyAuth, setBiologyAuthEnable } =
    useBiologyAuth();
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <Button
          onPress={() => {
            Dialog.confirm({
              title: 'SetupPassword',
              renderContent: (
                <PasswordSetup
                  onSetupRes={(data) => {
                    console.log('setup data', data);
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
            Dialog.confirm({
              title: 'UpdatePassword',
              renderContent: (
                <PasswordUpdate
                  onUpdateRes={(data) => {
                    console.log('update data', data);
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
            Dialog.confirm({
              title: 'ConfirmPassword',
              renderContent: (
                <PasswordVerify
                  onVerifyRes={(data) => {
                    console.log('verify data', data);
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
