import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Icon, Text, VStack } from '@onekeyhq/components';

import Layout from '../../Layout';

import type { EOnboardingRoutes } from '../../routes/enums';
import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.ImportWallet
>;

const ImportItem = () => {
  // TODO: replace bottom container
  console.log('1');
  return (
    <VStack
      px={{ base: 4 }}
      pt={{ base: 4 }}
      bg={{ base: 'action-secondary-default' }}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={{ base: 'border-default' }}
      rounded={{ base: 'xl' }}
    >
      <Icon size={24} name="CloudOutline" color="interactive-default" />
      <Text my={{ base: 4 }} typography={{ sm: 'Heading', md: 'Heading' }}>
        With Recovery Phrase, Private Key or Address
      </Text>
      <Box>3</Box>
    </VStack>
  );
};

const defaultProps = {} as const;

const ImportWallet = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();

  const disableAnimation = route?.params?.disableAnimation;

  return (
    <Layout
      disableAnimation={disableAnimation}
      title={intl.formatMessage({ id: 'action__import_wallet' })}
    >
      <Text
        typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}
        color={{ base: 'text-subdued' }}
      >
        Choose how you would like to import your wallet.
      </Text>
      <ImportItem />
    </Layout>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
