import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Modal,
  SegmentedControl,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import type { CoinControlRoutesParams } from '@onekeyhq/kit/src/routes';
import type { CoinControlModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../hooks';

import { CoinControlList } from './components/List';
import { ModalFooter, ModalHeader } from './components/ModalComponent';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CoinControlRoutesParams,
  CoinControlModalRoutes.CoinControlModal
>;

const CoinControl = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [utxosWithoutDust, setUtxosWithoutDust] = useState<
    ICoinControlListItem[]
  >([]);
  const [utxosDust, setUtxosDust] = useState<ICoinControlListItem[]>([]);
  const [frozenUtxos, setFrozenUtxos] = useState<ICoinControlListItem[]>([]);
  const [selectedUtxos, setSelectedUtxos] = useState<string[]>([]);
  const [blockTimeMap, setBlockTimeMap] = useState<Record<string, number>>({});
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [token, setToken] = useState<Token>();

  const { network } = useNetwork({ networkId });

  useEffect(() => {
    backgroundApiProxy.serviceUtxos
      .getUtxos(networkId, accountId)
      .then((response) => {
        setUtxosWithoutDust(response.utxosWithoutDust);
        setUtxosDust(response.utxosDust);
        setFrozenUtxos(response.frozenUtxos);
        return response.utxos;
      })
      .then((utxos) => {
        backgroundApiProxy.serviceUtxos
          .getUtxosBlockTime(networkId, accountId, utxos)
          .then((response) => {
            setBlockTimeMap(response);
          });
      });
    backgroundApiProxy.engine
      .findToken({
        networkId,
        tokenIdOnNetwork: '',
      })
      .then((tokenRes) => {
        setToken(tokenRes);
      });
  }, [networkId, accountId]);

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
      {selectedIndex === 0 && (
        <CoinControlList
          accountId={accountId}
          network={network as unknown as Network}
          token={token}
          utxosWithoutDust={utxosWithoutDust}
          utxosDust={utxosDust}
          selectedUtxos={selectedUtxos}
          isAllSelected={isAllSelected}
          setIsAllSelected={setIsAllSelected}
          blockTimeMap={blockTimeMap}
        />
      )}
      {selectedIndex === 1 && (
        <Center flex={1}>
          <Empty
            emoji="🪙"
            title={intl.formatMessage({
              id: 'content__no_coins',
            })}
            subTitle={intl.formatMessage({
              id: 'content__no_utxos_in_this_account',
            })}
          />
        </Center>
      )}
    </Modal>
  );
};

export default CoinControl;
