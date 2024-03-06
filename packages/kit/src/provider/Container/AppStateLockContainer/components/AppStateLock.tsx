import { memo } from 'react';

import {
  Button,
  Heading,
  IconButton,
  Image,
  YStack,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/kit/assets/logo_round_decorated.png';

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
    <YStack flex={1} bg="$bgApp">
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        p="$8"
        space="$8"
      >
        <YStack space="$4" alignItems="center">
          <Image w={72} h={72} src={Logo} />
          <Heading size="$headingLg" textAlign="center">
            Welcome Back
          </Heading>
        </YStack>
        <YStack>{passwordVerifyContainer}</YStack>
        {enableWebAuth && (
          <IconButton icon="FaceArcSolid" onPress={onWebAuthVerify} />
        )}
      </YStack>
      <YStack py="$8" alignItems="center">
        <Button size="small" variant="tertiary">
          Forgot Password?
        </Button>
      </YStack>
    </YStack>
  );
};

export default memo(AppStateLock);
