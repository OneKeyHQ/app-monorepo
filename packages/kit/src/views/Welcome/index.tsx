import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Center,
  Image,
  Typography,
  VStack,
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

  const onRestore = useCallback(() => {
    navigation.navigate(OnboardingRoutes.Modal, {
      screen: CreateWalletModalRoutes.ImportWalletModal,
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
    <Center w="full" h="full" bg="surface-default">
      <Box h="full" w="full" maxW="400px" px={8}>
        <Box
          flex={1}
          py={8}
          justifyContent={{ base: 'center', md: 'flex-end' }}
        >
          <Center mb={8}>
            <Image w="16" h="16" source={logo} alt="logo" />
          </Center>
          <Typography.DisplayXLarge mb="2" textAlign="center">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
          </Typography.DisplayXLarge>
          <Typography.Body1 color="text-subdued" textAlign="center">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
          </Typography.Body1>
        </Box>
        <Box flex={{ md: 1 }} alignItems="center" pt={8} pb={bottom + 8}>
          <VStack
            space={{ base: 4, md: 3 }}
            mb={{ base: 16, md: 8 }}
            w={{ base: 'full', md: '240px' }}
          >
            <Button
              size={isVertical ? 'xl' : 'base'}
              type="primary"
              onPress={onCreate}
            >
              {intl.formatMessage({ id: 'action__create_wallet' })}
            </Button>
            <Button size={isVertical ? 'xl' : 'base'} onPress={onRestore}>
              {intl.formatMessage({ id: 'action__i_already_have_a_wallet' })}
            </Button>
            <Button
              size={isVertical ? 'xl' : 'base'}
              type="plain"
              onPress={onSkip}
            >
              {intl.formatMessage({ id: 'action__skip' })}
            </Button>
          </VStack>
          <Typography.Caption
            mt="auto"
            maxW="300px"
            textAlign="center"
            color="text-subdued"
          >
            {intl.formatMessage(
              { id: 'content__agree_to_user_agreement_and_privacy_policy' },
              {
                a: (text) => (
                  <Typography.CaptionUnderline
                    color="text-subdued"
                    onPress={onOpenUserAgreement}
                  >
                    {text}
                  </Typography.CaptionUnderline>
                ),
                b: (text) => (
                  <Typography.CaptionUnderline
                    color="text-subdued"
                    onPress={onOpenPrivacyPolicy}
                  >
                    {text}
                  </Typography.CaptionUnderline>
                ),
              },
            )}
          </Typography.Caption>
        </Box>
      </Box>
    </Center>
  );
};

export default Welcome;
