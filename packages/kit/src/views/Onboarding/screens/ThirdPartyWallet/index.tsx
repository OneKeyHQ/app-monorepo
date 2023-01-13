import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';

import Layout from '../../Layout';

const ThirdPartyWallet = () => {
  const intl = useIntl();

  return (
    <Layout title={intl.formatMessage({ id: 'title__connect_with' })}>
      <Box>
        <Text>1</Text>
      </Box>
    </Layout>
  );
};

ThirdPartyWallet.displayName = 'ThirdPartyWallet';

export default ThirdPartyWallet;
