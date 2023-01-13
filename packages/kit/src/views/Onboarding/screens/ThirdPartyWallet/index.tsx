import { useIntl } from 'react-intl';

import { Box, Center, Text } from '@onekeyhq/components';

import {
  ConnectWalletListItem,
  ConnectWalletListView,
} from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useAddExternalAccount } from '../../../ExternalAccount/useAddExternalAccount';
import Layout from '../../Layout';

const ThirdPartyWallet = () => {
  const intl = useIntl();

  const { addExternalAccount } = useAddExternalAccount();

  const navigation = useAppNavigation();

  return (
    <Layout title={intl.formatMessage({ id: 'title__connect_with' })}>
      <Center
        justifyContent="flex-start"
        flexDir={{ sm: 'row' }}
        flexWrap={{ sm: 'wrap' }}
        alignSelf="stretch"
        mx={-1}
      >
        <ConnectWalletListView
          onConnectResult={async (result) => {
            await addExternalAccount(result);
            navigation?.goBack?.();
          }}
        />
      </Center>
    </Layout>
  );
};

ThirdPartyWallet.displayName = 'ThirdPartyWallet';

export default ThirdPartyWallet;
