import type { FC } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Text, useIsVerticalLayout } from '@onekeyhq/components';
import { httpServerEnable } from '@onekeyhq/kit-bg/src/services/ServiceHTTP';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import Layout from '../../../Layout';

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
    intl.formatMessage({ id: 'content__migration_step_2' }),
    selectRange === 0
      ? intl.formatMessage(
          { id: 'content__migration_step_3' },
          {
            addOn: (
              <Text
                typography={{ sm: 'Body2', md: 'Body1' }}
                color="text-subdued"
              >
                {intl.formatMessage({ id: 'content__migration_step_3_add_on' })}
              </Text>
            ),
          },
        )
      : intl.formatMessage({ id: 'content__migration_step_3_connect_by_link' }),
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

      <Text typography="Body2" mt="24px" color="text-disabled">
        {intl.formatMessage({ id: 'content__migration_note_encrypted' })}
      </Text>
      <Text typography="Body2" color="text-disabled">
        {intl.formatMessage({ id: 'content__migration_note_hardware_wallet' })}
      </Text>
    </Box>
  );
};

const defaultProps = {} as const;

const Migration = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const { serviceHTTP, serviceMigrate } = backgroundApiProxy;

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

  useEffect(() => {
    serviceMigrate.initServiceMigrate();
    return () => {
      serviceHTTP.stopHttpServer();
    };
  }, [serviceHTTP, serviceMigrate]);

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
