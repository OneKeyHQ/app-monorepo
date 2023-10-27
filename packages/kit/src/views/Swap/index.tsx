import { memo, useState } from 'react';

import { Button, Screen, Text, YStack } from '@onekeyhq/components';

import PasswordDialog from '../../components/Password/PasswordDialog';

const Swap = () => {
  console.log('swap');
  const [open, setOpen] = useState(false);
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <Button
          onPress={() => {
            setOpen(!open);
          }}
        >
          密码验证弹窗
        </Button>
        <PasswordDialog
          onClose={() => {
            setOpen(false);
          }}
          open={open}
        />
      </YStack>
    </Screen>
  );
};

export default memo(Swap);
