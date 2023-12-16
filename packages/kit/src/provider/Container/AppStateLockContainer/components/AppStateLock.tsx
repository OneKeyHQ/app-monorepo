import { memo } from 'react';

import { Icon, IconButton, YStack } from '@onekeyhq/components';

interface IAppStateLockProps {
  passwordVerifyContainer: React.ReactNode;
  onWebAuthVerify: () => void;
  enableWebAuth: boolean;
}

const AppStateLock = ({
  passwordVerifyContainer,
  onWebAuthVerify,
  enableWebAuth,
}: IAppStateLockProps) => {
  console.log('app state lock');
  return (
    <YStack
      space="$5"
      justifyContent="center"
      alignItems="center"
      flex={1}
      backgroundColor="$background"
    >
      <Icon name="LockOutline" size="$5" />
      <YStack minWidth="$64">{passwordVerifyContainer}</YStack>
      {enableWebAuth && (
        <IconButton icon="FaceArcSolid" onPress={onWebAuthVerify} />
      )}
    </YStack>
  );
};

export default memo(AppStateLock);
