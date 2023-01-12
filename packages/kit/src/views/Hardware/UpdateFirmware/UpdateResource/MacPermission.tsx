import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Image,
  LottieView,
  Text,
  VStack,
  useTheme,
} from '@onekeyhq/components';
import RestartTouch from '@onekeyhq/kit/assets/animations/restart-touch.json';
import MacSecurityPrivacyLightImage from '@onekeyhq/kit/assets/mac_security_and_privacy.png';
import MacSecurityPrivacyDarkImage from '@onekeyhq/kit/assets/mac_security_and_privacy_dark.png';

const Title = ({ marker, title }: { marker: string; title: string }) => (
  <HStack space={3}>
    <Center bg="interactive-default" w={6} h={6} rounded="full">
      <Text typography={{ sm: 'CaptionStrong', md: 'CaptionStrong' }}>
        {marker}
      </Text>
    </Center>
    <Text typography={{ sm: 'Body1Strong', md: 'Body1Strong' }}>{title}</Text>
  </HStack>
);

const Marker = ({
  marker,
  content,
  children,
}: {
  marker: string;
  content: string;
  children?: React.ReactNode;
}) => (
  <HStack space={3}>
    <Text typography={{ sm: 'Body2', md: 'Body2' }} color="text-subdued">
      {marker}
    </Text>
    <VStack>
      <Text typography={{ sm: 'Body2', md: 'Body2' }} color="text-subdued">
        {content}
      </Text>
      {children}
    </VStack>
  </HStack>
);

const MacPermission = () => {
  const { themeVariant } = useTheme();
  const intl = useIntl();
  const PrivacyImage = useMemo(() => {
    const source =
      themeVariant === 'light'
        ? MacSecurityPrivacyLightImage
        : MacSecurityPrivacyDarkImage;
    return <Image source={source} size={360} height={270} resizeMode="cover" />;
  }, [themeVariant]);

  return (
    <Box>
      {/* First Step */}
      <HStack justifyContent={{ base: 'space-between' }}>
        <VStack space={4} flex={1} mr={6}>
          <Title
            marker="I"
            title={intl.formatMessage({ id: 'content__restart_device' })}
          />
          <Text typography={{ sm: 'Body2', md: 'Body2' }} color="text-subdued">
            {intl.formatMessage({
              id: 'content__restart_device_to_exit_boardloader',
            })}
          </Text>
        </VStack>
        <Center
          w={360}
          h={206}
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
          rounded="lg"
        >
          <LottieView
            source={RestartTouch}
            autoPlay
            loop
            style={{ width: '360px' }}
          />
        </Center>
      </HStack>

      <Divider my={6} />

      {/* Second Step */}
      <HStack justifyContent={{ base: 'space-between' }}>
        <VStack space={4} flex={1} mr={6}>
          <Title
            marker="II"
            title={intl.formatMessage({
              id: 'content__enable_mac_permissions_for_oneKey',
            })}
          />
          <VStack space={4} pl={2}>
            <Marker
              marker="1."
              content={intl.formatMessage({
                id: 'content__enable_mac_permissions_for_oneKey_step_1',
              })}
            >
              <Button
                type="basic"
                size="sm"
                maxWidth={191}
                mt={2}
                onPress={() => {
                  window.desktopApi?.openPrivacyPanel?.();
                }}
              >
                {intl.formatMessage({ id: 'action__open_system_preference' })}
              </Button>
            </Marker>
            <Marker
              marker="2."
              content={intl.formatMessage({
                id: 'content__enable_mac_permissions_for_oneKey_step_2',
              })}
            />
            <Marker
              marker="3."
              content={intl.formatMessage({
                id: 'content__enable_mac_permissions_for_oneKey_step_3',
              })}
            />
            <Marker
              marker="4."
              content={intl.formatMessage({
                id: 'content__enable_mac_permissions_for_oneKey_step_4',
              })}
            />
          </VStack>
        </VStack>
        <Center>{PrivacyImage}</Center>
      </HStack>
    </Box>
  );
};

MacPermission.displayName = 'MacPermission';

export default MacPermission;
