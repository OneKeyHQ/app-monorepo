import type { FC } from 'react';
import { useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Text, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Layout from '../../../Layout';
import { httpServerEnable } from '../util';

import SecondaryContent from './SecondaryContent';

import type { IBoxProps } from 'native-base';

const DescriptionListItem: FC<{ step: any; description: any } & IBoxProps> = ({
  step,
  description,
  ...rest
}) => (
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

const MigrationDescription: FC<{
  selectRange: number;
}> = ({ selectRange }) => {
  const intl = useIntl();

  const DESCRIPTIONS = [
    intl.formatMessage({ id: 'content__migration_step_1' }),
    intl.formatMessage(
      { id: 'content__migration_step_2' },
      {
        addOn: (
          <>
            {!platformEnv.isNative ? (
              <Text
                typography={{ sm: 'Body2', md: 'Body1' }}
                color="text-subdued"
              >
                {intl.formatMessage({ id: 'content__migration_step_2_add_on' })}
              </Text>
            ) : (
              ''
            )}
          </>
        ),
      },
    ),
    'Scan the QR Code. If you are using OneKey Extension, go to Migration, then paste the link below the QR Code to OneKey Extension',
  ];

  return (
    <Box>
      {DESCRIPTIONS.map((description, index) => (
        <DescriptionListItem
          key={index}
          step={index + 1}
          description={description}
          mt={index === 0 ? undefined : '16px'}
        />
      ))}

      <Text typography="Body2" mt="24px" color="text-subdued">
        {intl.formatMessage({ id: 'content__migration_note' })}
      </Text>
    </Box>
  );
};

const defaultProps = {} as const;

const Migration = () => {
  const intl = useIntl();

  const navigation = useNavigation();

  const [selectRange, setSelectedRange] = useState(() => {
    if (!httpServerEnable()) {
      return 1;
    }
    return 0;
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const isVerticalLayout = useIsVerticalLayout();

  const leftCompoment = useMemo(() => {
    if (isVerticalLayout) {
      return (
        <SecondaryContent
          selectRange={selectRange}
          onChange={setSelectedRange}
        />
      );
    }
    return <MigrationDescription selectRange={selectRange} />;
  }, [isVerticalLayout, selectRange]);

  const rightCompoment = useMemo(() => {
    if (isVerticalLayout) {
      return <MigrationDescription selectRange={selectRange} />;
    }
    return (
      <SecondaryContent selectRange={selectRange} onChange={setSelectedRange} />
    );
  }, [isVerticalLayout, selectRange]);

  return (
    <Layout
      disableAnimation
      title={intl.formatMessage({ id: 'title__migration' })}
      description={intl.formatMessage({ id: 'title__migration_desc' })}
      secondaryContent={rightCompoment}
    >
      {leftCompoment}
    </Layout>
  );
};

Migration.defaultProps = defaultProps;

export default Migration;
