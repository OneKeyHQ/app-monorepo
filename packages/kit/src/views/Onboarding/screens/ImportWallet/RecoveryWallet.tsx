import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Spinner, Text, useThemeValue } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { OnboardingAddExistingWallet } from '../../../CreateWallet/AddExistingWallet';
import Layout from '../../Layout';

import Drawer from './ImportWalletGuideDrawer';
import SecondaryContent from './SecondaryContent';

import type { EOnboardingRoutes } from '../../routes/enums';
import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';

const defaultProps = {} as const;

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.ImportWallet
>;

const RecoveryWallet = () => {
  const intl = useIntl();
  const bgColor = useThemeValue('background-default');
  const onBoardingLoadingBehindModal = useAppSelector(
    (s) => s.runtime.onBoardingLoadingBehindModal,
  );
  const [drawerVisible, setDrawerVisible] = useState(false);
  const route = useRoute<RouteProps>();
  const onPressDrawerTrigger = useCallback(() => {
    setDrawerVisible(true);
  }, []);
  const disableAnimation = route?.params?.disableAnimation;

  return onBoardingLoadingBehindModal ? (
    <Center bgColor={bgColor} flex={1} height="full">
      <Spinner size="lg" />
    </Center>
  ) : (
    <>
      <Layout
        disableAnimation={disableAnimation}
        title={intl.formatMessage({ id: 'onboarding__import_with_phrase' })}
        secondaryContent={
          <SecondaryContent onPressDrawerTrigger={onPressDrawerTrigger} />
        }
      >
        <Text
          typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}
          mt={{ base: -6, sm: -12 }}
          mb={{ base: 3, sm: 9 }}
        >
          Private Key or Address
        </Text>
        <OnboardingAddExistingWallet />
      </Layout>
      <Drawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
    </>
  );
};

RecoveryWallet.defaultProps = defaultProps;

export default RecoveryWallet;
