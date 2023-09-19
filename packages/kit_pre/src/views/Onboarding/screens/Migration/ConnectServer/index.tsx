import type { FC } from 'react';
import { useEffect, useLayoutEffect, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Text, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import Layout from '../../../Layout';

import {
  MigrateContextProvider,
  ServerStatus,
  useMigrateContext,
} from './context';
import SecondaryContent from './SecondaryContent';

import type { EOnboardingRoutes } from '../../../routes/enums';
import type { IOnboardingRoutesParams } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { IBoxProps } from 'native-base';

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.Migration
>;

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

const MigrationDescription: FC = () => {
  const intl = useIntl();
  const context = useMigrateContext()?.context;

  const DESCRIPTIONS = [
    <Text
      typography={{ sm: 'Body2', md: 'Body1' }}
      color={
        context?.selectRange === 0 && context.serverStatus === ServerStatus.Fail
          ? 'text-critical'
          : 'text-default'
      }
    >
      {intl.formatMessage({ id: 'content__migration_step_1' })}
    </Text>,
    intl.formatMessage({ id: 'content__migration_step_2' }),
    context?.selectRange === 0
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

  if (platformEnv.isDesktopWin) {
    DESCRIPTIONS.splice(
      1,
      0,
      intl.formatMessage({ id: 'content__migration_step_2_windows' }),
    );
  }
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

  const route = useRoute<RouteProps>();
  const { scanText, disableAnimation = true } = route.params;

  const navigation = useNavigation();
  const { serviceHTTP, serviceMigrate } = backgroundApiProxy;

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

  useEffect(() => {
    serviceMigrate.registerHttpEvents();
    return () => {
      serviceHTTP.stopHttpServer();
      serviceMigrate.unRegisterHttpEvents();
    };
  }, [serviceHTTP, serviceMigrate]);

  return (
    <MigrateContextProvider inputValue={scanText ?? ''}>
      <Layout
        disableAnimation={disableAnimation}
        title={intl.formatMessage({ id: 'title__migration' })}
        description={intl.formatMessage({ id: 'title__migration_desc' })}
        secondaryContent={rightCompoment}
      >
        {leftCompoment}
      </Layout>
    </MigrateContextProvider>
  );
};

Migration.defaultProps = defaultProps;

export default Migration;
