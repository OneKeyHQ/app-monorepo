import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Center, Spinner, useThemeValue } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { OnboardingAddExistingWallet } from '../../../CreateWallet/AddExistingWallet';
import Layout from '../../Layout';

import Drawer from './ImportWalletGuideDrawer';
import SecondaryContent from './SecondaryContent';

const defaultProps = {} as const;

const ImportWallet = () => {
  const intl = useIntl();
  const bgColor = useThemeValue('background-default');
  const { onBoardingLoadingBehindModal } = useAppSelector((s) => s.runtime);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const onPressDrawerTrigger = useCallback(() => {
    setDrawerVisible(true);
  }, []);

  return (
    <>
      {onBoardingLoadingBehindModal ? (
        <Center bgColor={bgColor} flex={1} height="full">
          <Spinner size="lg" />
        </Center>
      ) : (
        <>
          <Layout
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
