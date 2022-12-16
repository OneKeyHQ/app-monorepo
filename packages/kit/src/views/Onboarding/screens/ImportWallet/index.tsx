import { useCallback, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Spinner, useThemeValue } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { OnboardingAddExistingWallet } from '../../../CreateWallet/AddExistingWallet';
import Layout from '../../Layout';
import { EOnboardingRoutes } from '../../routes/enums';
import { IOnboardingRoutesParams } from '../../routes/types';

import Drawer from './ImportWalletGuideDrawer';
import SecondaryContent from './SecondaryContent';

const defaultProps = {} as const;

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.ImportWallet
>;

const ImportWallet = () => {
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

  return (
    <>
      {onBoardingLoadingBehindModal ? (
        <Center bgColor={bgColor} flex={1} height="full">
          <Spinner size="lg" />
        </Center>
      ) : (
        <>
          <Layout
            disableAnimation={disableAnimation}
            title={intl.formatMessage({ id: 'action__import_wallet' })}
            secondaryContent={
              <SecondaryContent onPressDrawerTrigger={onPressDrawerTrigger} />
            }
          >
            <OnboardingAddExistingWallet />
          </Layout>
          <Drawer
            visible={drawerVisible}
            onClose={() => setDrawerVisible(false)}
          />
        </>
      )}
    </>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
