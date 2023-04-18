import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Modal,
  SegmentedControl,
  ToastManager,
} from '@onekeyhq/components';
import { getUtxoUniqueKey } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
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
  const [allUtxos, setAllUtxos] = useState<ICoinControlListItem[]>([]);
  const [utxosWithoutDust, setUtxosWithoutDust] = useState<
    ICoinControlListItem[]
  >([]);
  const [utxosDust, setUtxosDust] = useState<ICoinControlListItem[]>([]);
  const [frozenUtxos, setFrozenUtxos] = useState<ICoinControlListItem[]>([]);
  const [selectedUtxos, setSelectedUtxos] = useState<string[]>([]);
  const [blockTimeMap, setBlockTimeMap] = useState<Record<string, number>>({});
  const [token, setToken] = useState<Token>();

  const { network } = useNetwork({ networkId });

  const refreshUtxosData = useCallback(
    () =>
      backgroundApiProxy.serviceUtxos
        .getUtxos(networkId, accountId)
        .then((response) => {
          setAllUtxos(response.utxos);
          setUtxosWithoutDust(response.utxosWithoutDust);
          setUtxosDust(response.utxosDust);
          setFrozenUtxos(response.frozenUtxos);
          return response.utxos;
        }),
    [networkId, accountId],
  );

  useEffect(() => {
    refreshUtxosData().then((utxos) => {
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
  }, [networkId, accountId, refreshUtxosData]);

  const isAllSelected = useMemo(
    () =>
      allUtxos.length > 0 &&
      allUtxos.every((utxo) => selectedUtxos.includes(getUtxoUniqueKey(utxo))),
    [selectedUtxos, allUtxos],
  );

  const [, setIsSelectedAllInner] = useState(false);
  const triggerAllSelected = useCallback(
    (value: boolean) => {
      setIsSelectedAllInner(value);
      if (value) {
        setSelectedUtxos(allUtxos.map((utxo) => getUtxoUniqueKey(utxo)));
      } else {
        setSelectedUtxos([]);
      }
    },
    [allUtxos],
  );

  const onCheckBoxChange = useCallback(
    (item: ICoinControlListItem) => {
      const key = getUtxoUniqueKey(item);
      if (selectedUtxos.includes(key)) {
        setSelectedUtxos(selectedUtxos.filter((utxoKey) => utxoKey !== key));
      } else {
        setSelectedUtxos([...selectedUtxos, key]);
      }
    },
    [selectedUtxos],
  );

  const onConfirmEditLabel = useCallback(
    (item: ICoinControlListItem, label: string) => {
      backgroundApiProxy.serviceUtxos
        .updateLabel(networkId, accountId, item, label)
        .then(() => {
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__success' }),
          });
          refreshUtxosData();
        });
    },
    [networkId, accountId, refreshUtxosData, intl],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__coin_control' })}
      headerDescription={<ModalHeader networkId={networkId} />}
      footer={
        <ModalFooter
          accountId={accountId}
          network={network}
          token={token}
          allUtxos={allUtxos}
          dustUtxos={utxosDust}
          selectedUtxos={selectedUtxos}
          targetAmount="0.0003"
        />
      }
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
          allUtxos={allUtxos}
          utxosWithoutDust={utxosWithoutDust}
          utxosDust={utxosDust}
          selectedUtxos={selectedUtxos}
          isAllSelected={isAllSelected}
          triggerAllSelected={triggerAllSelected}
          blockTimeMap={blockTimeMap}
          onChange={onCheckBoxChange}
          onConfirmEditLabel={onConfirmEditLabel}
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
