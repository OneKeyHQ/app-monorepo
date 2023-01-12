import type { FC } from 'react';
import { useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Text, useIsVerticalLayout } from '@onekeyhq/components';

import Layout from '../../../Layout';

import SecondaryContent from './SecondaryContent';

import type { IBoxProps } from 'native-base';

const DescriptionListItem: FC<
  { step: any; description: string } & IBoxProps
> = ({ step, description, ...rest }) => (
  <Box flexDirection="row" {...rest}>
    <Center
      size="28px"
      borderRadius="full"
      bgColor="surface-neutral-subdued"
      mr="12px"
    >
      <Text typography="CaptionStrong" color="text-subdued">
        {step}
      </Text>
    </Center>
    <Text
      py={{ base: '4px', md: '2px' }}
      typography={{ sm: 'Body2', md: 'Body1' }}
      flex={1}
    >
      {description}
    </Text>
  </Box>
);

const MigrationDescription = () => {
  const intl = useIntl();

  const DESCRIPTIONS = [
    'Keep devices on same local network',
    'Open another OneKey',
    'Scan the QR Code. If you are using OneKey Extension, go to Migration, then paste the link below the QR Code to OneKey Extension',
  ];

  return (
    <Box>
      {DESCRIPTIONS.map((description) => (
        <DescriptionListItem
          step={DESCRIPTIONS.indexOf(description) + 1}
          description={description}
          mt={DESCRIPTIONS.indexOf(description) === 0 ? undefined : '16px'}
        />
      ))}

      <Text typography="Body2" mt="24px" color="text-subdued">
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
      disableAnimation
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
