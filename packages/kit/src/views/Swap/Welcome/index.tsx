import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Center, Modal, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';

const SwapFeatures = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  useEffect(() => {
    backgroundApiProxy.serviceSwap.setSwapWelcomeShown(true);
  }, []);
  return (
    <Box>
      <Center mt="8" mb="10">
        <Typography.DisplayLarge>
          {intl.formatMessage({ id: 'title__welcome_to_onekey_swap' })}
        </Typography.DisplayLarge>
        <Typography.Body2 color="text-subdued" mt="2">
          {intl.formatMessage({ id: 'title__welcome_to_onekey_swap_desc' })}
        </Typography.Body2>
      </Center>
      <Box>
        <Box flexDirection="row" mb="8">
          <Typography.DisplayXLarge mr="4">🌈</Typography.DisplayXLarge>
          <Box flex="1">
            <Typography.DisplayMedium>
              {intl.formatMessage({ id: 'form__cross_chain_swap' })}
            </Typography.DisplayMedium>
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage(
                { id: 'form__cross_chain_swap_desc' },
                { '0': '25' },
              )}
            </Typography.Body1>
          </Box>
        </Box>
        <Box flexDirection="row" mb="8">
          <Typography.DisplayXLarge mr="4">🛡️</Typography.DisplayXLarge>
          <Box flex="1">
            <Typography.DisplayMedium>
              {intl.formatMessage({ id: 'form__exact_amount_allowance' })}
            </Typography.DisplayMedium>
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({
                id: 'form__exact_amount_allowance_significantly_reduces_risk_exposure',
              })}
            </Typography.Body1>
          </Box>
        </Box>
        <Box flexDirection="row" mb="8">
          <Typography.DisplayXLarge mr="4">👥</Typography.DisplayXLarge>
          <Box flex="1">
            <Typography.DisplayMedium>
              {intl.formatMessage({ id: 'form__designated_recipient' })}
            </Typography.DisplayMedium>
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({ id: 'form__designated_recipient_desc' })}
            </Typography.Body1>
          </Box>
        </Box>
      </Box>
      <Button
        size="xl"
        type="primary"
        mt="4"
        onPress={() => navigation.goBack()}
      >
        {intl.formatMessage({ id: 'action__i_got_it' })}
      </Button>
    </Box>
  );
};

const Welcome = () => (
  <Modal
    footer={null}
    scrollViewProps={{
      children: <SwapFeatures />,
    }}
  />
);

export default Welcome;
