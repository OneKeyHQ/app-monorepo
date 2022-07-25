import React, { FC } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';
import Svg, { Path, SvgProps } from 'react-native-svg';

import {
  Box,
  Icon,
  PresenceTransition,
  Text,
  useThemeValue,
} from '@onekeyhq/components';

function ExtensionIcon(props: SvgProps) {
  return (
    <Svg fill="currentColor" viewBox="0 0 16 16" stroke="none" {...props}>
      <Path d="M13.6673 7.33464H12.6673V4.66797C12.6673 3.93464 12.0673 3.33464 11.334 3.33464H8.66732V2.33464C8.66732 1.41464 7.92065 0.667969 7.00065 0.667969C6.08065 0.667969 5.33398 1.41464 5.33398 2.33464V3.33464H2.66732C1.93398 3.33464 1.34065 3.93464 1.34065 4.66797V7.2013H2.33398C3.32732 7.2013 4.13398 8.00797 4.13398 9.0013C4.13398 9.99464 3.32732 10.8013 2.33398 10.8013H1.33398V13.3346C1.33398 14.068 1.93398 14.668 2.66732 14.668H5.20065V13.668C5.20065 12.6746 6.00732 11.868 7.00065 11.868C7.99398 11.868 8.80065 12.6746 8.80065 13.668V14.668H11.334C12.0673 14.668 12.6673 14.068 12.6673 13.3346V10.668H13.6673C14.5873 10.668 15.334 9.9213 15.334 9.0013C15.334 8.0813 14.5873 7.33464 13.6673 7.33464Z" />
    </Svg>
  );
}

function PinIcon(props: SvgProps) {
  return (
    <Svg fill="currentColor" viewBox="0 0 16 16" stroke="none" {...props}>
      <Path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10.6673 5.9987V2.66536H11.334C11.7007 2.66536 12.0007 2.36536 12.0007 1.9987C12.0007 1.63203 11.7007 1.33203 11.334 1.33203H4.66732C4.30065 1.33203 4.00065 1.63203 4.00065 1.9987C4.00065 2.36536 4.30065 2.66536 4.66732 2.66536H5.33398V5.9987C5.33398 7.10536 4.44065 7.9987 3.33398 7.9987V9.33203H7.31398V13.9987L7.98065 14.6654L8.64732 13.9987V9.33203H12.6673V7.9987C11.5607 7.9987 10.6673 7.10536 10.6673 5.9987Z"
      />
    </Svg>
  );
}

type PinPanelProps = {
  visible?: boolean;
};

const defaultProps = {} as const;

const PinPanel: FC<PinPanelProps> = ({ visible }) => {
  const intl = useIntl();

  return (
    <>
      <PresenceTransition
        as={Box}
        // @ts-expect-error
        position="absolute"
        top={2}
        right={2}
        w={280}
        p={4}
        bgColor="surface-default"
        rounded="xl"
        borderWidth={1}
        borderColor="divider"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 150 } }}
        visible={visible}
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
            <ExtensionIcon
              width={16}
              height={16}
              color={useThemeValue('icon-default')}
            />
          </Box>
          <Box p={2} rounded="full">
            <Icon name="DotsVerticalSolid" size={16} />
          </Box>
        </Box>
        <Box
          flexDir="row"
          alignItems="center"
          py={3}
          px={4}
          borderWidth={1}
          borderColor="border-default"
          rounded="xl"
          shadow="depth.5"
        >
          <Icon name="BrandLogoIllus" size={16} />
          <Text flex={1} mx={3} typography="Body2">
            OneKey
          </Text>
          <PinIcon width={16} height={16} color="#325FFA" />
        </Box>
      </PresenceTransition>
    </>
  );
};

PinPanel.defaultProps = defaultProps;

export default PinPanel;
