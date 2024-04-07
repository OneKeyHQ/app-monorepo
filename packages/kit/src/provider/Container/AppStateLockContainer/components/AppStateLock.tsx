import type { ForwardedRef } from 'react';
import { memo } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { IThemeableStackProps } from '@onekeyhq/components';
import {
  Button,
  Heading,
  Image,
  OverlayContainer,
  Stack,
  ThemeableStack,
  useKeyboardEvent,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/kit/assets/logo_round_decorated.png';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { APP_STATE_LOCK_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import type { View as IView } from 'react-native';

interface IAppStateLockProps extends IThemeableStackProps {
  passwordVerifyContainer: React.ReactNode;
  lockContainerRef: ForwardedRef<IView>;
}

const safeKeyboardHeight = 80;

const useSafeKeyboardAnimationStyle = platformEnv.isNative
  ? () => {
      const keyboardHeightValue = useSharedValue(0);
      const animatedStyles = useAnimatedStyle(() => ({
        paddingBottom: keyboardHeightValue.value,
      }));
      useKeyboardEvent({
        keyboardWillShow: () => {
          keyboardHeightValue.value = withTiming(safeKeyboardHeight);
        },
        keyboardWillHide: () => {
          keyboardHeightValue.value = withTiming(0);
        },
      });
      return animatedStyles;
    }
  : () => ({});

const AppStateLock = ({
  passwordVerifyContainer,
  lockContainerRef,
  ...props
}: IAppStateLockProps) => {
  const { bottom } = useSafeAreaInsets();
  const resetApp = useResetApp({ inAppStateLock: true });

  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();

  return (
    <OverlayContainer>
      <ThemeableStack
        testID="unlock-screen"
        ref={lockContainerRef}
        position="absolute"
        fullscreen
        // keep the lock screen interface at the top by the z-index on Web & Android
        zIndex={APP_STATE_LOCK_Z_INDEX}
        elevation={platformEnv.isNativeAndroid ? -1 : undefined}
        flex={1}
        bg="$bgApp"
        {...props}
      >
        <Stack
          flex={1}
          justifyContent="center"
          alignItems="center"
          p="$8"
          space="$8"
        >
          <Stack space="$4" alignItems="center">
            <Image w={72} h={72} source={Logo} />
            <Heading size="$headingLg" textAlign="center">
              Welcome Back
            </Heading>
          </Stack>
          <Stack
            w="100%"
            $gtMd={{
              maxWidth: '$80',
            }}
          >
            <Animated.View style={safeKeyboardAnimationStyle}>
              {passwordVerifyContainer}
            </Animated.View>
          </Stack>
        </Stack>
        <Stack py="$8" mb={bottom ?? 'unset'} alignItems="center">
          <Button size="small" variant="tertiary" onPress={resetApp}>
            Forgot Password?
          </Button>
        </Stack>
      </ThemeableStack>
    </OverlayContainer>
  );
};

export default memo(AppStateLock);
