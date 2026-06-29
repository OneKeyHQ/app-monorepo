import type { ForwardedRef } from 'react';
import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { IThemeableStackProps } from '@onekeyhq/components';
import {
  Button,
  DesktopDragZoneBox,
  Heading,
  Image,
  Keyboard,
  Stack,
  ThemeableStack,
  updateHeightWhenKeyboardHide,
  updateHeightWhenKeyboardShown,
  useKeyboardEventWithoutNavigation,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import Logo from '@onekeyhq/kit/assets/logo_round_decorated.png';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import { showExportLogsDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/showExportLogsDialog';
import {
  usePasswordPersistAtom,
  useV4migrationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { APP_STATE_LOCK_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';
import { verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import { DevPerpsWebSocketUpdateView } from '../../FullWindowOverlayContainer/DevOverlayWindow';

import { AppStateContainer } from './AppStateContainer';

import type { View as IView, KeyboardEvent } from 'react-native';

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
      useKeyboardEventWithoutNavigation({
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
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();

  const handleExportLogs = useCallback(async () => {
    // Gate the hidden lock-screen log-upload entry behind a biometric check so
    // a bystander holding the locked device cannot exfiltrate diagnostic
    // metadata. Only the biometric prompt needs to pass — NOT the passcode,
    // NOT the secure-storage password decrypt. When biometric is unavailable we
    // keep the entry open so users locked out there can still upload
    // diagnostics. (OK-56874 review)
    if (platformEnv.isExtension) {
      // Extension biometric is WebAuthn (Touch ID / Windows Hello via the
      // platform authenticator). It can only be verified against an already
      // registered credential, which exists once the user enabled PassKey /
      // biometric unlock. `verifiedWebAuth` only asserts the credential with
      // userVerification — it does NOT decrypt the stored password.
      // `platformAuthenticatorOnly` forces THIS device's built-in biometric and
      // blocks the cross-device "use a passkey on another device" / USB-key
      // flows.
      if (webAuthCredentialId) {
        try {
          const cred = await verifiedWebAuth(webAuthCredentialId, {
            platformAuthenticatorOnly: true,
          });
          if (cred?.id !== webAuthCredentialId) {
            return;
          }
        } catch {
          // user cancelled or verification failed
          return;
        }
      }
    } else if (await biologyAuth.isSupportBiologyAuth()) {
      const authRes = await biologyAuth.biologyAuthenticate();
      if (!authRes.success) {
        return;
      }
    }
    showExportLogsDialog({
      title: intl.formatMessage({
        id: ETranslations.settings_upload_state_logs,
      }),
      inAppStateLock: true,
    });
  }, [intl, webAuthCredentialId]);

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
        pointerEvents={platformEnv.isNative ? undefined : 'auto'}
        onPress={Keyboard.dismiss}
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
            <DesktopDragZoneBox
              position="absolute"
              top={0}
              left={0}
              right={0}
              renderAs="Stack"
              height="$12"
            />
            <Stack gap="$4" alignItems="center">
              {/* Hidden support entry: a continuous multi-click on the logo
                  (NOT a long-press) opens the state-log upload dialog. Uses
                  MultipleClickStack's default threshold — it fires on the 12th
                  consecutive tap in production (5th in dev). Keep it
                  deliberately hard to trigger so it is not hit by accident on
                  the lock screen. (OK-56874) */}
              <MultipleClickStack onPress={handleExportLogs}>
                <Image w={72} h={72} source={Logo} />
              </MultipleClickStack>
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
          <DevPerpsWebSocketUpdateView />
          <Stack py="$8" mb={bottom ?? 'unset'} alignItems="center">
            {v4migrationData?.isMigrationModalOpen ||
            v4migrationData?.isProcessing ? null : (
              <Button
                size="small"
                variant="tertiary"
                onPress={resetApp}
                testID="app-state-lock.tsx-btn"
              >
                {intl.formatMessage({
                  id: ETranslations.login_forgot_passcode,
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
