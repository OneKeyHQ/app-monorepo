import { memo } from 'react';

import { Icon, Stack } from '@onekeyhq/components';

interface IAppStateLockProps {
  passwordVerifyContainer: React.ReactNode;
}

const AppStateLock = ({ passwordVerifyContainer }: IAppStateLockProps) => {
  console.log('app state lock');
  return (
    <Stack justifyContent="center" alignItems="center" flex={1}>
      <Icon name="LockOutline" size="$5" />
      {passwordVerifyContainer}
    </Stack>
  );
};

export default memo(AppStateLock);
