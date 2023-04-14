import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, HStack, Text, Token, VStack } from '@onekeyhq/components';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '@onekeyhq/kit/src/components/Format';

import { useNetwork } from '../../../hooks';

export const ModalHeader: FC<{
  networkId: string;
}> = ({ networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        name={network?.name}
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

export const ModalFooter: FC<any> = () => {
  const intl = useIntl();
  return (
    <Box p={4} pt={0}>
      <Text typography="Caption" color="text-critical" mt={2}>
        {intl.formatMessage(
          { id: 'msg__str_btc_missing_from_tx_input' },
          { 0: '0.0000053 BTC' },
        )}
      </Text>
      <Text typography="Caption" color="text-warning" mt={2}>
        {intl.formatMessage({
          id: 'msg__using_dust_will_increase_tx_fee_and_reduce_anonymity_and_privacy',
        })}
      </Text>
      <HStack alignItems="flex-start" justifyContent="space-between" mt={2}>
        <Text typography="Body1Strong">2 selected</Text>
        <VStack alignItems="flex-end" space={1}>
          <FormatBalance
            balance="0.00000448"
            formatOptions={{
              fixed: 8,
            }}
            suffix="BTC"
            render={(ele) => <Text typography="Body1Strong">{ele}</Text>}
          />
          {/* <FormatCurrencyTokenOfAccount
            accountId={accountId}
            networkId={networkId}
            token={tokenInfo}
            value={amount}
            render={(ele) => (
              <Text typography="Body2" color="text-subdued">
                {ele}
              </Text>
            )}
          /> */}
          <Text typography="Body2" color="text-subdued">
            <FormatCurrencyNumber value={0} convertValue={33333} />
          </Text>
        </VStack>
      </HStack>
      <Button type="primary" size="xl" mt={4}>
        {intl.formatMessage({ id: 'action__done' })}
      </Button>
    </Box>
  );
};
