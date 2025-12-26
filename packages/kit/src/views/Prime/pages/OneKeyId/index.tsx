import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useUpdateEffect,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { usePrimeAvailable } from '../../hooks/usePrimeAvailable';
import { PrimeUserInfo } from '../PrimeDashboard/PrimeUserInfo';

function OneKeyIdPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { toInviteRewardPage } = useReferFriends();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { isLoggedIn, logout } = useOneKeyAuth();
  const logoutRef = useRef<() => Promise<void>>(logout);
  const isFocused = useRouteIsFocused();
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  const toPrimePage = useCallback(async () => {
    if (isPrimeAvailable) {
      if (platformEnv.isNative) {
        navigation.popStack();
        await timerUtils.wait(600);
      }
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
      });
    }
  }, [navigation, isPrimeAvailable]);

  const toKeylessWalletPage = useCallback(() => {
    navigation.push(EModalRoutes.PrimeModal, {
      screen: EPrimePages.KeylessWallet,
      params: {
        mode: EOnboardingV2KeylessWalletCreationMode.View,
      },
    });
  }, [navigation]);

  useUpdateEffect(() => {
    void (async () => {
      if (!isLoggedIn && isFocused) {
        await timerUtils.wait(300);
        navigation.popStack();
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'OneKeyIdPage: is focused and primePersistAtom is not logged in',
        });
        void logoutRef.current();
      }
    })();
  }, [isLoggedIn, navigation, isFocused]);

  return (
    <Page scrollEnabled>
      <Page.Header title="OneKey ID" />
      <Page.Body>
        <YStack>
          <YStack p="$5" ai="center" jc="center">
            <LinearGradient
              bg="$bgInverse"
              borderRadius="$3"
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0)']}
              width={56}
              height={56}
              jc="center"
              ai="center"
            >
              <Icon size="$8" name="PeopleSolid" color="$iconInverse" />
            </LinearGradient>
            <SizableText pt="$5" pb="$2" size="$heading2xl">
              OneKey ID
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyLg">
              {intl.formatMessage({ id: ETranslations.id_desc })}
            </SizableText>
          </YStack>
          <Stack p="$5">
            <PrimeUserInfo
              onLogoutSuccess={async () => {
                defaultLogger.referral.page.logoutOneKeyIDResult();
                navigation.popStack();
              }}
            />
          </Stack>
          <YStack>
            {isPrimeAvailable ? (
              <ListItem
                userSelect="none"
                drillIn={isPrimeAvailable}
                renderAvatar={
                  <XStack
                    borderRadius="$3"
                    bg="$brand7"
                    w="$12"
                    h="$12"
                    ai="center"
                    jc="center"
                  >
                    <Icon name="PrimeSolid" color="$brand12" size="$6" />
                  </XStack>
                }
                title="OneKey Prime"
                subtitle={intl.formatMessage({
                  id: ETranslations.id_prime,
                })}
                onPress={toPrimePage}
              >
                {isPrimeAvailable ? null : (
                  <Badge badgeSize="sm">
                    <Badge.Text>
                      {intl.formatMessage({
                        id: ETranslations.id_prime_soon,
                      })}
                    </Badge.Text>
                  </Badge>
                )}
              </ListItem>
            ) : null}

            <ListItem
              drillIn
              userSelect="none"
              renderAvatar={
                <XStack
                  borderRadius="$3"
                  bg="$purple8"
                  w="$12"
                  h="$12"
                  ai="center"
                  jc="center"
                >
                  <Icon name="GiftSolid" color="$purple12" size="$6" />
                </XStack>
              }
              title={intl.formatMessage({
                id: ETranslations.id_refer_a_friend,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.id_refer_a_friend_desc,
              })}
              onPress={toInviteRewardPage}
            />

            {platformEnv.isWebDappMode || !isKeylessWalletEnabled ? null : (
              <ListItem
                drillIn
                userSelect="none"
                renderAvatar={
                  <XStack
                    borderRadius="$3"
                    bg="$blue8"
                    w="$12"
                    h="$12"
                    ai="center"
                    jc="center"
                  >
                    <Icon name="WalletCryptoSolid" color="$blue12" size="$6" />
                  </XStack>
                }
                title="Keyless Wallet"
                subtitle="View your keyless wallet shares"
                onPress={toKeylessWalletPage}
              />
            )}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default function OneKeyId() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <OneKeyIdPage />
    </AccountSelectorProviderMirror>
  );
}
