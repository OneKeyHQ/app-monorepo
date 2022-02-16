import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Image,
  Typography,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import {
  OnboardingModalRoutes,
  OnboardingRoutes,
  OnboardingRoutesParams,
} from '@onekeyhq/kit/src/routes/Onboarding';

import sliderImg1 from '../../../../assets/slider_img1.png';
import sliderImg2 from '../../../../assets/slider_img2.png';
import sliderImg3 from '../../../../assets/slider_img3.png';
import AppIntroSlider from '../../../components/AppIntroSlider';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  OnboardingRoutesParams,
  OnboardingRoutes.Stack
>;

type SliderItem = { title: string; description: string; image: any };
// eslint-disable-next-line react/no-unused-prop-types
type ItemInfoParams = { item: SliderItem };

const Welcome = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isVerticalLayout = useIsVerticalLayout();
  const [defaultDotColor, activeDotColor] = useThemeValue([
    'icon-subdued',
    'icon-hovered',
  ]);
  const onStart = useCallback(() => {
    navigation.navigate(OnboardingRoutes.Modal, {
      screen: OnboardingModalRoutes.Terms,
    });
  }, [navigation]);
  const renderItem = useCallback(
    ({ item }: ItemInfoParams) => (
      <Box
        w="full"
        display="flex"
        flexDirection="column"
        alignItems="center"
        pb="16"
        key={item.title}
      >
        <Box w="56" h="56">
          <Image source={item.image} w="full" h="full" />
        </Box>
        <Typography.DisplayXLarge mb="2" textAlign="center" px="4">
          {item.title}
        </Typography.DisplayXLarge>
        <Typography.Body2 textAlign="center" color="text-subdued" px="4">
          {item.description}
        </Typography.Body2>
      </Box>
    ),
    [],
  );
  const slides = [
    {
      title: intl.formatMessage({
        id: 'onboarding__landing_welcome_title',
        defaultMessage: 'Welcome to OneKey',
      }),
      description: intl.formatMessage({
        id: 'onboarding__landing_welcome_desc',
        defaultMessage: 'The one place for all your cryto assets',
      }),
      image: sliderImg1,
    },
    {
      title: intl.formatMessage({
        id: 'onboarding__landing_opensource_title',
        defaultMessage: 'Your Assets, \nOnly in Your Hands',
      }),
      description: intl.formatMessage({
        id: 'onboarding__landing_opensource_desc',
        defaultMessage:
          'OneKey will not store your private key or recovery seed, and all the hardware and software we made are open source.',
      }),
      image: sliderImg2,
    },
    {
      title: intl.formatMessage({
        id: 'onboarding__landing_encryption_title',
        defaultMessage: 'End-to-End Encryption',
      }),
      description: intl.formatMessage({
        id: 'onboarding__landing_encryption_desc',
        defaultMessage:
          'OneKey uses industry-leading encryption technology to store your information locally. Only you can decrypt the information.',
      }),
      image: sliderImg3,
    },
  ];
  return (
    <Center w="full" h="full" bg="background-default">
      <Box maxW="96" w="full">
        <Box w="full" h="96">
          <AppIntroSlider
            renderItem={renderItem}
            data={slides}
            dotStyle={{ backgroundColor: defaultDotColor }}
            activeDotStyle={{ backgroundColor: activeDotColor }}
            showNextButton={false}
            showDoneButton={false}
          />
        </Box>
        <Box
          w="full"
          px="8"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Button
            type="primary"
            w={isVerticalLayout ? 'full' : '48'}
            onPress={onStart}
          >
            {intl.formatMessage({
              id: 'action__get_started',
              defaultMessage: 'Get Started',
            })}
          </Button>
        </Box>
      </Box>
    </Center>
  );
};

export default Welcome;
