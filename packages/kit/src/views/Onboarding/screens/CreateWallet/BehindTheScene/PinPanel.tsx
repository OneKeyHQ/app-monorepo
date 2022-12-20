import type { FC } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  PresenceTransition,
  Text,
  useThemeValue,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type PinPanelProps = {
  visible?: boolean;
};

const defaultProps = {} as const;

const PinPanel: FC<PinPanelProps> = ({ visible }) => {
  const intl = useIntl();

  const shortcuts = ['⌥', '⇧', 'O'];

  return (
    <PresenceTransition
      as={Box}
      // @ts-expect-error
      position="absolute"
      top={4}
      right={4}
      w={280}
      initial={{ opacity: 0, translateY: -16, scale: 0.95 }}
      animate={{
        translateY: 0,
        opacity: 1,
        scale: 1,
        transition: { duration: 300, delay: 150 },
      }}
      visible={visible}
    >
      <Box
        p={4}
        bgColor="surface-default"
        rounded="xl"
        borderWidth={1}
        borderColor="divider"
      >
        <Text typography="Body2Strong">
          {intl.formatMessage({ id: 'content__pin_onekey_ext' })}
        </Text>
        <Box flexDir="row" my={2}>
          <LinearGradient
            colors={['transparent', useThemeValue('surface-neutral-subdued')]}
            style={{
              height: 32,
              flex: 1,
              borderRadius: 16,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Box
            ml={4}
            mr={1}
            p={2}
            rounded="full"
            bgColor="surface-neutral-subdued"
          >
            <Icon name="ExtensionsMini" color="icon-default" size={16} />
          </Box>
          <Box p={2} rounded="full">
            <Icon name="EllipsisVerticalMini" size={16} />
          </Box>
        </Box>
        <Box
          flexDir="row"
          alignItems="center"
          py={3}
          px={4}
          borderWidth={1}
          borderColor="border-subdued"
          rounded="xl"
          shadow="depth.4"
        >
          <Icon name="BrandLogoIllus" size={16} />
          <Text flex={1} mx={3} typography="Body2">
            OneKey
          </Text>
          <Icon name="PinMini" size={16} />
        </Box>
        <Box position="absolute" left="-112px" bottom="-69px">
          <Icon
            name="ArrowTopRightIllus"
            size={69}
            color="interactive-default"
          />
        </Box>
      </Box>
      {platformEnv.isExtension ? (
        <Box
          flexDirection="row"
          alignItems="center"
          mt="8px"
          p={4}
          bgColor="surface-default"
          rounded="xl"
          borderWidth={1}
          borderColor="divider"
        >
          <Text typography="Body2Strong" flex={1}>
            {intl.formatMessage({ id: 'content__keyboard_shortcut' })}
          </Text>
          <Box flexDirection="row" mx="-2px">
            {shortcuts.map((shortcut, index) => (
              <Box
                key={index}
                alignItems="center"
                minW="24px"
                mx="2px"
                py="4px"
                bgColor="surface-neutral-subdued"
                rounded="6px"
              >
                <Text fontSize={14} lineHeight={16}>
                  {shortcut}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      ) : undefined}
    </PresenceTransition>
  );
};

PinPanel.defaultProps = defaultProps;

export default PinPanel;
