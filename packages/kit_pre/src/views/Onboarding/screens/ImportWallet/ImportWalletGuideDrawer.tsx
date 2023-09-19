import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  IconButton,
  Image,
  PresenceTransition,
  Pressable,
  ScrollView,
  Text,
  ZStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import AccountDetails from '@onekeyhq/kit/assets/onboarding/account_details_on_metamask.png';
import ExtStepFourImage from '@onekeyhq/kit/assets/onboarding/desk_reveal.png';
import ExtStepThreeImage from '@onekeyhq/kit/assets/onboarding/desk_security.png';
import ExtStepTwoImage from '@onekeyhq/kit/assets/onboarding/desk_settings.png';
import ExtStepOneImage from '@onekeyhq/kit/assets/onboarding/desk_topbar.png';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import NativeStepFourImage from '@onekeyhq/kit/assets/onboarding/mobile_reveal.png';
import NativeStepThreeImage from '@onekeyhq/kit/assets/onboarding/mobile_security.png';
import NativeStepTwoImage from '@onekeyhq/kit/assets/onboarding/mobile_settings.png';
import ShowPrivateKey from '@onekeyhq/kit/assets/onboarding/mobile_show_private_key.png';
import NativeStepOneImage from '@onekeyhq/kit/assets/onboarding/mobile_topbar.png';

import type { IAddExistingWalletMode } from '../../../../routes';

type DrawerProps = {
  visible?: boolean;
  onClose?: () => void;
  mode?: IAddExistingWalletMode;
};

// MetaMask Import Guide
const Drawer: FC<DrawerProps> = ({ visible, onClose, mode }) => {
  const insets = useSafeAreaInsets();
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  const steps = useMemo(() => {
    if (mode === 'mnemonic')
      return [
        {
          desc: isVerticalLayout
            ? intl.formatMessage({ id: 'content__native_metamask_tutorials_1' })
            : intl.formatMessage({ id: 'content__ext_metamask_tutorials_1' }),
          image: isVerticalLayout ? NativeStepOneImage : ExtStepOneImage,
          imageHeight: isVerticalLayout ? '51px' : '56px',
        },
        {
          desc: intl.formatMessage({
            id: 'content__native_metamask_tutorials_2',
          }),
          image: isVerticalLayout ? NativeStepTwoImage : ExtStepTwoImage,
          imageHeight: isVerticalLayout ? '107px' : '103px',
        },
        {
          desc: intl.formatMessage({
            id: 'content__native_metamask_tutorials_3',
          }),
          image: isVerticalLayout ? NativeStepThreeImage : ExtStepThreeImage,
          imageHeight: isVerticalLayout ? '99px' : '110px',
        },
        {
          desc: intl.formatMessage({
            id: 'content__native_metamask_tutorials_4',
          }),
          image: isVerticalLayout ? NativeStepFourImage : ExtStepFourImage,
          imageHeight: isVerticalLayout ? '59px' : '66px',
        },
        {
          desc: intl.formatMessage({
            id: 'content__native_metamask_tutorials_5',
          }),
        },
      ];

    return [
      {
        desc: isVerticalLayout
          ? intl.formatMessage({ id: 'content__native_metamask_tutorials_1' })
          : intl.formatMessage({ id: 'content_click_account_details' }),
        image: isVerticalLayout ? NativeStepOneImage : AccountDetails,
        imageHeight: isVerticalLayout ? '51px' : '233px',
      },
      {
        desc: isVerticalLayout
          ? intl.formatMessage({
              id: 'content__native_metamask_tutorials_2',
            })
          : intl.formatMessage({
              id: 'content__click_on_show_private_key',
            }),
        image: isVerticalLayout ? NativeStepTwoImage : ShowPrivateKey,
        imageHeight: isVerticalLayout ? '107px' : '66px',
      },
      {
        desc: isVerticalLayout
          ? intl.formatMessage({
              id: 'content__native_metamask_tutorials_3',
            })
          : intl.formatMessage({
              id: 'content__copy_and_private_key',
            }),
        image: isVerticalLayout ? NativeStepThreeImage : '',
        imageHeight: isVerticalLayout ? '99px' : '110px',
      },
      {
        desc: isVerticalLayout
          ? intl.formatMessage({
              id: 'content__click_on_show_private_key',
            })
          : '',
        image: isVerticalLayout ? ShowPrivateKey : '',
        imageHeight: '59px',
      },
      {
        desc: isVerticalLayout
          ? intl.formatMessage({
              id: 'content__copy_and_private_key',
            })
          : '',
      },
    ];
  }, [intl, isVerticalLayout, mode]);

  return (
    <PresenceTransition
      as={ZStack}
      // @ts-expect-error
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      visible={visible}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 150 } }}
    >
      {/* Backdrop */}
      {!isVerticalLayout ? (
        <Pressable
          top={0}
          right={0}
          bottom={0}
          left={0}
          bgColor="backdrop"
          opacity={0.75}
          onPress={onClose}
        />
      ) : null}
      {/* Content */}
      <PresenceTransition
        visible={visible}
        as={Box}
        // @ts-expect-error
        top={0}
        right={0}
        bottom={0}
        w="full"
        maxW="400px"
        pt={`${16 + insets.top}px`}
        bgColor="background-default"
        pointerEvents="auto"
        initial={{ opacity: 0, translateX: 400 }}
        animate={{ opacity: 1, translateX: 0, transition: { duration: 150 } }}
      >
        <IconButton
          type="plain"
          circle
          size="lg"
          name="XMarkOutline"
          alignSelf="flex-end"
          onPress={onClose}
          mr={4}
        />
        <ScrollView flex={1} px={{ base: 6, sm: 12 }}>
          <Image
            source={LogoMetaMask}
            size={8}
            rounded="xl"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-subdued"
          />
          <Text mt={4} mb={8} typography="DisplayLarge">
            {intl.formatMessage(
              { id: 'content__import_wallet_from_str' },
              { '0': 'MetaMask' },
            )}
          </Text>
          {steps.map((step, index) => (
            <Box mb={8} key={index}>
              {step.desc && (
                <Text typography="Body2" mb={4}>
                  {index + 1}. {step.desc}
                </Text>
              )}
              {step.image && (
                <Image
                  w="full"
                  h={step.imageHeight}
                  source={step.image}
                  resizeMode="cover"
                />
              )}
            </Box>
          ))}
        </ScrollView>
      </PresenceTransition>
    </PresenceTransition>
  );
};

export default Drawer;
