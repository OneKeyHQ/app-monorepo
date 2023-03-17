import type { FC } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  Icon,
  Image,
  Pressable,
  Spinner,
  Text,
  useTheme,
  useThemeValue,
} from '@onekeyhq/components';
import type { IconProps } from '@onekeyhq/components/src/Icon';
import KeyTagPNG from '@onekeyhq/kit/assets/onboarding/import_with_keytag.png';
import OneKeyLitePNG from '@onekeyhq/kit/assets/onboarding/import_with_lite.png';

interface OptionProps {
  icon?: IconProps['name'];
  title?: string;
  description?: string;
  children?: React.ReactNode;
  isDisabled?: boolean;
  isLoading?: boolean;
  onPress?: () => void;
}

const Option: FC<OptionProps> = ({
  icon,
  title,
  description,
  children,
  isDisabled,
  isLoading,
  onPress,
}) => {
  const { themeVariant } = useTheme();

  return (
    <Pressable
      flex={1} // Implement equal height on the same row
      onPress={onPress}
      p="16px"
      pb="80px"
      bg="action-secondary-default"
      _hover={{ bgColor: 'action-secondary-hovered' }}
      _pressed={{ bgColor: 'action-secondary-pressed' }}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="border-default"
      borderRadius="12px"
      overflow="hidden"
      disabled={isDisabled}
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Icon
          name={icon || 'AcademicCapOutline'}
          color={
            isDisabled || isLoading ? 'icon-disabled' : 'interactive-default'
          }
        />
        {isLoading && <Spinner />}
      </Box>
      <Text
        mt={4}
        typography="Heading"
        flex={1}
        color={isDisabled || isLoading ? 'text-disabled' : 'text-default'}
      >
        {title}
      </Text>
      {description && (
        <Text
          mt={1}
          typography="Body2"
          flex={1}
          color={isDisabled || isLoading ? 'text-disabled' : 'text-subdued'}
        >
          {description}
        </Text>
      )}
      <Box
        position="absolute"
        bottom="-64px"
        left="16px"
        right="16px"
        h="128px"
        borderRadius="12px"
        bg="surface-default"
        overflow="hidden"
      >
        <LinearGradient
          colors={['rgb(255, 255, 255)', 'rgba(255, 255, 255, 0)']}
          style={{
            position: 'absolute',
            height: 64,
            width: '100%',
            opacity: 0.1,
            zIndex: -1,
          }}
        />
        {children}
        <LinearGradient
          colors={[
            themeVariant === 'light'
              ? 'rgba(255, 255, 255, 0)'
              : 'rgba(30, 30, 42, 0)',
            useThemeValue('surface-default'),
          ]}
          style={{
            position: 'absolute',
            height: '100%',
            width: '100%',
            bottom: 64,
          }}
        />
      </Box>
    </Pressable>
  );
};

export const OptionRecoveryPhrase: FC<OptionProps> = ({
  title,
  icon,
  description,
  onPress,
}) => (
  <Option
    title={title}
    description={description}
    icon={icon || 'ClipboardDocumentListOutline'}
    onPress={onPress}
  >
    <Box flexDirection="row" px="16px" h="64px" flexWrap="wrap" py="8px">
      {['shy', 'owner', 'almost', 'explain', 'movie', 'subway'].map(
        (phrase, index) => (
          <Box flexDirection="row" w="1/3" py="4px" key={index}>
            <Text typography="Caption" w="12px" color="text-subdued">
              {index + 1}
            </Text>
            <Text typography="Caption">{phrase}</Text>
          </Box>
        ),
      )}
    </Box>
  </Option>
);
export const OptionPrivateKey: FC<OptionProps> = ({
  title,
  icon,
  description,
  onPress,
}) => (
  <Option
    title={title}
    description={description}
    icon={icon || 'ClipboardDocumentListOutline'}
    onPress={onPress}
  >
    <Box px="16px" h="64px" pt="12px">
      <Text typography="Caption" color="text-subdued">
        0xd819390d77f9bfe05b74c729394deec8c4e7f3ec52b6cbe9f64b6a0e1c9d9435
      </Text>
    </Box>
  </Option>
);
export const OptionAdress: FC<OptionProps> = ({
  title,
  icon,
  description,
  onPress,
}) => (
  <Option
    title={title}
    description={description}
    icon={icon || 'ClipboardDocumentListOutline'}
    onPress={onPress}
  >
    <Box px="16px" h="64px" pt="12px">
      <Text typography="Caption" color="text-subdued">
        0xb0CfcFdA37F05185324dC3A61dE9030bf6d98fb8
      </Text>
    </Box>
  </Option>
);

export const OptionOneKeyLite: FC<OptionProps> = ({
  title,
  description,
  onPress,
}) => (
  <Option
    title={title}
    description={description}
    icon="OnekeyLiteOutline"
    onPress={onPress}
  >
    <Center>
      <Image source={OneKeyLitePNG} w="224px" h="64px" />
    </Center>
  </Option>
);

export const OptionKeyTag: FC<OptionProps> = ({
  title,
  description,
  onPress,
}) => (
  <Option
    title={title}
    description={description}
    icon="KeytagOutline"
    onPress={onPress}
  >
    <Center>
      <Image source={KeyTagPNG} w="224px" h="64px" />
    </Center>
  </Option>
);

const IconToIconIllus = ({
  leftIcon,
  rightIcon,
}: {
  leftIcon: IconProps['name'];
  rightIcon: IconProps['name'];
}) => (
  <Center h="64px" flexDirection="row" px="24px">
    <Icon name={leftIcon} size={32} color="icon-default" />
    <LinearGradient
      colors={['transparent', useThemeValue('icon-subdued'), 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flex: 1,
        height: 2,
        marginHorizontal: 8,
      }}
    />
    <Icon name={rightIcon} size={32} color="icon-default" />
  </Center>
);

export const OptionMigration: FC<OptionProps> = ({ title, onPress }) => (
  <Option title={title} icon="ArrowPathRoundedSquareOutline" onPress={onPress}>
    <IconToIconIllus
      leftIcon="ComputerDesktopSolid"
      rightIcon="DevicePhoneMobileSolid"
    />
  </Option>
);

export const OptioniCloud: FC<OptionProps> = ({
  title,
  onPress,
  isDisabled,
  isLoading,
}) => (
  <Option
    title={title}
    icon="CloudOutline"
    onPress={onPress}
    isDisabled={isDisabled}
    isLoading={isLoading}
  >
    <IconToIconIllus leftIcon="CloudSolid" rightIcon="OnekeyLogoSolid" />
  </Option>
);

export const OptionGoogleDrive: FC<OptionProps> = ({
  title,
  onPress,
  isDisabled,
  isLoading,
}) => (
  <Option
    title={title}
    icon="CloudOutline"
    onPress={onPress}
    isDisabled={isDisabled}
    isLoading={isLoading}
  >
    <IconToIconIllus leftIcon="CloudSolid" rightIcon="OnekeyLogoSolid" />
  </Option>
);
