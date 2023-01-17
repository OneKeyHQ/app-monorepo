import { useIntl } from 'react-intl';

import { Box, Center, Text } from '@onekeyhq/components';

import { ConnectWalletListView } from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
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
      <Box mt="24px">
        <Text typography="Subheading" color="text-subdued">
          {intl.formatMessage({ id: 'content__institutional_wallets' })}
        </Text>
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
            isInstitutionWallet
          />
        </Center>
      </Box>
    </Layout>
  );
};

ThirdPartyWallet.displayName = 'ThirdPartyWallet';

export default ThirdPartyWallet;
