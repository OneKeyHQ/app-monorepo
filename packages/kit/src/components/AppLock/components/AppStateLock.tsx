import { memo } from 'react';

import { Icon, YStack } from '@onekeyhq/components';

interface IAppStateLockProps {
  passwordVerifyContainer: React.ReactNode;
}

const AppStateLock = ({ passwordVerifyContainer }: IAppStateLockProps) => {
  console.log('app state lock');
  return (
    <YStack space="$5" justifyContent="center" alignItems="center" flex={1}>
      <Icon name="LockOutline" size="$5" />
      {passwordVerifyContainer}
    </YStack>
  );
};

export default memo(AppStateLock);
