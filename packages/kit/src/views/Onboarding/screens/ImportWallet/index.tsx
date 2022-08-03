import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { OverlayContainer } from '@onekeyhq/components';

import { OnboardingAddExistingWallet } from '../../../CreateWallet/AddExistingWallet';
import Layout from '../../Layout';

import Drawer from './ImportWalletGuideDrawer';
import SecondaryContent from './SecondaryContent';

const defaultProps = {} as const;

const ImportWallet = () => {
  const intl = useIntl();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const onPressDrawerTrigger = useCallback(() => {
    setDrawerVisible(true);
  }, []);

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'action__import_wallet' })}
        secondaryContent={
          <SecondaryContent onPressDrawerTrigger={onPressDrawerTrigger} />
        }
      >
        <OnboardingAddExistingWallet />
        <OverlayContainer>
          <Drawer
            visible={drawerVisible}
            onClose={() => setDrawerVisible(false)}
          />
        </OverlayContainer>
      </Layout>
    </>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
