import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Center,
  Image,
  Stack,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import logo from '../../../assets/logo.png';
import { useAppDispatch } from '../../hooks/redux';
import { useHelpLink } from '../../hooks/useHelpLink';
import { CreateWalletModalRoutes } from '../../routes/Modal/CreateWallet';
import {
  OnboardingRoutes,
  OnboardingRoutesParams,
  OnboardingStackRoutes,
} from '../../routes/Onboarding/types';
import { setBoardingCompleted } from '../../store/reducers/status';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  OnboardingRoutesParams,
  OnboardingRoutes.Stack
>;

const Welcome = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { bottom } = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();

  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });

  const dispatch = useAppDispatch();
  const onSkip = useCallback(() => {
    dispatch(setBoardingCompleted());
  }, [dispatch]);

  const onCreate = useCallback(() => {
    navigation.navigate(OnboardingRoutes.Modal, {
      screen: CreateWalletModalRoutes.CreateWalletModal,
    });
  }, [navigation]);

  const onOpenUrl = useCallback(
    (url: string, title?: string) => {
      if (['android', 'ios'].includes(Platform.OS)) {
        navigation.navigate(OnboardingRoutes.Stack, {
          screen: OnboardingStackRoutes.Webview,
          params: { url, title },
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );

  const onOpenUserAgreement = useCallback(() => {
    onOpenUrl(
      userAgreementUrl,
      intl.formatMessage({
        id: 'form__user_agreement',
      }),
    );
  }, [intl, onOpenUrl, userAgreementUrl]);

  const onOpenPrivacyPolicy = useCallback(() => {
    onOpenUrl(
      privacyPolicyUrl,
      intl.formatMessage({
        id: 'form__privacy_policy',
      }),
    );
  }, [intl, onOpenUrl, privacyPolicyUrl]);

  return (
    <Center w="full" h="full" bg="background-default">
      <Box maxW="96" w="full" h="full" position="relative">
        <Center w="full" h="full">
          <Center w="full">
            <Image w="16" h="16" source={logo} alt="logo" mb="8" />
            <Typography.DisplayXLarge mb="2">
              {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
            </Typography.DisplayXLarge>
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
            </Typography.Body1>
          </Center>
          <Center mt={isVertical ? '32' : '16'} px="4" w="full">
            <Stack
              direction="column"
              space="2"
              maxW={isVertical ? undefined : '64'}
              w="full"
            >
              <Button size="xl" type="primary" onPress={onCreate}>
                {intl.formatMessage({ id: 'action__create_wallet' })}
              </Button>
              <Button size="xl">
                {intl.formatMessage({ id: 'action__i_already_have_a_wallet' })}
              </Button>
              <Button size="xl" type="plain" onPress={onSkip}>
                {intl.formatMessage({ id: 'action__skip' })}
              </Button>
            </Stack>
          </Center>
        </Center>
        <Box position="absolute" bottom={bottom + 8} w="full">
          <Center w="full">
            <Typography.Caption textAlign="center">
              {intl.formatMessage(
                { id: 'content__agree_to_user_agreement_and_privacy_policy' },
                {
                  a: (text) => (
                    <Typography.CaptionUnderline onPress={onOpenUserAgreement}>
                      {text}
                    </Typography.CaptionUnderline>
                  ),
                  b: (text) => (
                    <Typography.CaptionUnderline onPress={onOpenPrivacyPolicy}>
                      {text}
                    </Typography.CaptionUnderline>
                  ),
                },
              )}
            </Typography.Caption>
          </Center>
        </Box>
      </Box>
    </Center>
  );
};

export default Welcome;
