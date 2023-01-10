import { useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Text, useIsVerticalLayout } from '@onekeyhq/components';

import Layout from '../../Onboarding/Layout';

import SecondaryContent from './SecondaryContent';

const MigrationDescription = () => {
  const intl = useIntl();
  return (
    <Box>
      <Box flexDirection="row">
        <Center
          size="28px"
          borderRadius="full"
          bgColor="surface-neutral-subdued"
          mr="12px"
        >
          <Text typography="CaptionStrong" color="text-subdued">
            1
          </Text>
        </Center>
        <Text mt="4px" typography="Body2" flex={1}>
          Keep devices on same local network
        </Text>
      </Box>

      <Box flexDirection="row" mt="16px">
        <Center
          size="28px"
          borderRadius="full"
          bgColor="surface-neutral-subdued"
          mr="12px"
        >
          <Text typography="CaptionStrong" color="text-subdued">
            2
          </Text>
        </Center>
        <Text mt="4px" typography="Body2" flex={1}>
          Open another OneKey
        </Text>
      </Box>

      <Box flexDirection="row" mt="16px">
        <Center
          size="28px"
          borderRadius="full"
          bgColor="surface-neutral-subdued"
          mr="12px"
        >
          <Text typography="CaptionStrong" color="text-subdued">
            3
          </Text>
        </Center>
        <Text mt="4px" typography="Body2" flex={1}>
          Scan the QR Code. If you are using OneKey Extension, go to Migration,
          then paste the link below the QR Code to OneKey Extension
        </Text>
      </Box>

      <Text typography="Body2" mt="28px" color="text-subdued">
        Note: Your wallets is encrypted using your password. OneKey won't
        migrate your hardware wallets; you should write down your phrase and
        keep it safe.
      </Text>
    </Box>
  );
};

const defaultProps = {} as const;

const Migration = () => {
  const intl = useIntl();

  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const isVerticalLayout = useIsVerticalLayout();

  const leftCompoment = useMemo(() => {
    if (isVerticalLayout) {
      return <SecondaryContent />;
    }
    return <MigrationDescription />;
  }, [isVerticalLayout]);

  const rightCompoment = useMemo(() => {
    if (isVerticalLayout) {
      return <MigrationDescription />;
    }
    return <SecondaryContent />;
  }, [isVerticalLayout]);

  return (
    <Layout
      title="Migrate"
      description="between OneKey"
      secondaryContent={rightCompoment}
    >
      {leftCompoment}
    </Layout>
  );
};

Migration.defaultProps = defaultProps;

export default Migration;
