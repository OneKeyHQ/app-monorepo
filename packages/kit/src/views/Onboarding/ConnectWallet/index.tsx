import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Image, Pressable, Text } from '@onekeyhq/components';
import DeviceMobile from '@onekeyhq/kit/assets/onboarding/device_classic_touch.png';
import DeviceAll from '@onekeyhq/kit/assets/onboarding/device_mini_classic_touch.png';
import OneKeyLite from '@onekeyhq/kit/assets/onekey-lite.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Layout from '../Layout';

import SecondaryContent from './SecondaryContent';

type ConnectWalletProps = {
  visible?: boolean;
  onPressBackButton?: () => void;
};

const defaultProps = {} as const;

const ConnectWallet: FC<ConnectWalletProps> = ({
  visible,
  onPressBackButton,
}) => {
  const intl = useIntl();

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'title__connect_with' })}
        secondaryContent={<SecondaryContent />}
        visible={visible}
        onPressBackButton={onPressBackButton}
      >
        <Pressable
          h={{ base: 200, sm: 240 }}
          pt={4}
          pb={5}
          px={5}
          rounded="xl"
          bgColor="surface-default"
          _hover={{ bgColor: 'surface-hovered' }}
          _pressed={{ bgColor: 'surface-pressed' }}
          borderWidth={1}
          borderColor="border-subdued"
        >
          <Text typography="Heading" mb="auto">
            OneKey{'\n'}
            {intl.formatMessage({ id: 'wallet__hardware_wallet' })}
          </Text>
          <Icon name="ArrowRightOutline" />
          <Image
            position="absolute"
            bottom={0}
            right={{ base: -16, sm: -24 }}
            source={platformEnv.isNative ? DeviceMobile : DeviceAll}
            height={{ base: 200, sm: 235 }}
            width={{ base: 243, sm: 285 }}
          />
        </Pressable>
        <Box mt={{ base: 6, sm: 4 }} mx={{ base: -2, sm: 0 }}>
          <Pressable
            flexDir="row"
            alignItems="center"
            px={{ base: 2, sm: 4 }}
            py={3}
            rounded="xl"
            borderWidth={{ sm: 1 }}
            borderColor="border-subdued"
            bgColor={{ sm: 'surface-default' }}
            _hover={{ bgColor: 'surface-hovered' }}
            _pressed={{ bgColor: 'surface-pressed' }}
          >
            <Image source={OneKeyLite} size={8} />
            <Text
              flex={1}
              mx={3}
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              OneKey Lite
            </Text>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
        </Box>
      </Layout>
    </>
  );
};

ConnectWallet.defaultProps = defaultProps;

export default React.memo(ConnectWallet);
