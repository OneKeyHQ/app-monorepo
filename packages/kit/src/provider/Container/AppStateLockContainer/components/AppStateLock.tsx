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
  : () => ({ flex: 1 });

const AppStateLock = ({
  passwordVerifyContainer,
  lockContainerRef,
  ...props
}: IAppStateLockProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const resetApp = useResetApp({ inAppStateLock: true });
  const [v4migrationData] = useV4migrationAtom();

  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();

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
        <Animated.View style={safeKeyboardAnimationStyle}>
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
          <Stack py="$8" mb={bottom ?? 'unset'} alignItems="center">
            {v4migrationData?.isMigrationModalOpen ||
            v4migrationData?.isProcessing ? null : (
              <Button size="small" variant="tertiary" onPress={resetApp}>
                {intl.formatMessage({
                  id: ETranslations.login_forgot_password,
                })}
              </Button>
            )}
          </Stack>
        </Animated.View>
      </ThemeableStack>
    </AppStateContainer>
  );
};

export default memo(AppStateLock);
