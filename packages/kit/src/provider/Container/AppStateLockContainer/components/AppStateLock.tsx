import type { ForwardedRef } from 'react';
import { memo } from 'react';

import { useIntl } from 'react-intl';
import {
  Dimensions,
  type View as IView,
  type KeyboardEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { IThemeableStackProps } from '@onekeyhq/components';
import {
  Button,
  Heading,
  Image,
  Stack,
  ThemeableStack,
  updateHeightWhenKeyboardHide,
  updateHeightWhenKeyboardShown,
  useKeyboardEvent,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/kit/assets/logo_round_decorated.png';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import { useV4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { APP_STATE_LOCK_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { AppStateContainer } from './AppStateContainer';

interface IAppStateLockProps extends IThemeableStackProps {
  passwordVerifyContainer: React.ReactNode;
  lockContainerRef: ForwardedRef<IView>;
}

const useSafeKeyboardAnimationStyle = platformEnv.isNative
  ? () => {
      const keyboardHeightValue = useSharedValue(0);
      const animatedStyles = useAnimatedStyle(() => ({
        flex: 1,
        bottom: keyboardHeightValue.value,
        position: 'relative',
      }));
      useKeyboardEvent({
        keyboardWillShow: (event: KeyboardEvent) => {
          keyboardHeightValue.value = updateHeightWhenKeyboardShown(
            event?.endCoordinates?.height
              ? (200 * event.endCoordinates.height) /
                  Dimensions.get('window').height
              : 80,
          );
        },
        keyboardWillHide: () => {
          keyboardHeightValue.value = updateHeightWhenKeyboardHide();
        },
      });
      return animatedStyles;
    }
  : () => ({ flex: 1, position: 'relative' });

const useForgotPasswordAnimationStyle = platformEnv.isNative
  ? () => {
      const { bottom } = useSafeAreaInsets();
      const keyboardHeightValue = useSharedValue(bottom);
      const animatedStyles = useAnimatedStyle(() => ({
        position: 'absolute',
        bottom: keyboardHeightValue.value,
        width: '100%',
        alignItems: 'center',
        paddingVertical: 32,
      }));
      useKeyboardEvent({
        keyboardWillShow: (event: KeyboardEvent) => {
          if (event?.endCoordinates?.height) {
            keyboardHeightValue.value = updateHeightWhenKeyboardShown(
              event.endCoordinates.height - bottom - 60,
            );
          }
        },
        keyboardWillHide: () => {
          keyboardHeightValue.value = updateHeightWhenKeyboardHide(bottom);
        },
      });
      return animatedStyles;
    }
  : () => ({
      position: 'relative',
      paddingVertical: 32,
      width: '100%',
      alignItems: 'center',
    });

const AppStateLock = ({
  passwordVerifyContainer,
  lockContainerRef,
  ...props
}: IAppStateLockProps) => {
  const intl = useIntl();
  const resetApp = useResetApp({ inAppStateLock: true });
  const [v4migrationData] = useV4migrationAtom();

  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  const forgotPasswordAnimationStyle = useForgotPasswordAnimationStyle();
  return (
    <AppStateContainer>
      <ThemeableStack
        testID="unlock-screen"
        ref={lockContainerRef}
        position="absolute"
        fullscreen
        // keep the lock screen interface at the top by the z-index on Web & Android
        zIndex={APP_STATE_LOCK_Z_INDEX}
        flex={1}
        bg="$bgApp"
        {...props}
      >
        <Animated.View style={safeKeyboardAnimationStyle as any}>
          <Stack
            flex={1}
            justifyContent="center"
            alignItems="center"
            p="$8"
            gap="$8"
          >
            <Stack gap="$4" alignItems="center">
              <Image w={72} h={72} source={Logo} />
              <Heading size="$headingLg" textAlign="center">
                {intl.formatMessage({
                  id: ETranslations.login_welcome_message,
                })}
              </Heading>
            </Stack>
            <Stack
              w="100%"
              $gtMd={{
                maxWidth: '$80',
              }}
            >
              {passwordVerifyContainer}
            </Stack>
          </Stack>
          {
            // 126px placeholder maintains consistent spacing when keyboard is hidden
            platformEnv.isNative ? <Stack h={126} /> : null
          }
          <Animated.View style={forgotPasswordAnimationStyle as any}>
            {v4migrationData?.isMigrationModalOpen ||
            v4migrationData?.isProcessing ? null : (
              <Button size="small" variant="tertiary" onPress={resetApp}>
                {intl.formatMessage({
                  id: ETranslations.login_forgot_passcode,
                })}
              </Button>
            )}
          </Animated.View>
        </Animated.View>
      </ThemeableStack>
    </AppStateContainer>
  );
};

export default memo(AppStateLock);
