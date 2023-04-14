import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  HStack,
  Modal,
  SegmentedControl,
  Text,
  Token,
  VStack,
} from '@onekeyhq/components';
import {
  FormatBalance,
  FormatCurrencyNumber,
  FormatCurrencyTokenOfAccount,
} from '@onekeyhq/kit/src/components/Format';
import type { CoinControlRoutesParams } from '@onekeyhq/kit/src/routes';
import type { CoinControlModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../hooks';

import { CoinControlList } from './components/List';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CoinControlRoutesParams,
  CoinControlModalRoutes.CoinControlModal
>;

const ModalHeader: FC<{
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

const ModalFooter: FC<any> = () => {
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

const CoinControl = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    backgroundApiProxy.serviceUtxos.getUtxos(networkId, accountId);
  }, []);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__coin_control' })}
      headerDescription={<ModalHeader networkId={networkId} />}
      footer={<ModalFooter />}
    >
      <Box mb={4}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'action__available_tab' }),
            intl.formatMessage({ id: 'action__frozen_tab' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>
      {/* <Center flex={1}>
        <Empty
          emoji="🪙"
          title={intl.formatMessage({
            id: 'content__no_coins',
          })}
          subTitle={intl.formatMessage({
            id: 'content__no_utxos_in_this_account',
          })}
        />
      </Center> */}
      <CoinControlList />
    </Modal>
  );
};

export default CoinControl;
