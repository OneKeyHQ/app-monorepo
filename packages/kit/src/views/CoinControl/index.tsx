import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  IconButton,
  Modal,
  SegmentedControl,
  Spinner,
  ToastManager,
} from '@onekeyhq/components';
import { getUtxoUniqueKey } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import type { CoinControlRoutesParams } from '@onekeyhq/kit/src/routes';
import type { CoinControlModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNetwork } from '../../hooks';

import {
  CoinControlListMenu,
  useCoinControlListMenu,
} from './components/CoinControlListMenu';
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
  const { networkId, accountId, isSelectMode, encodedTx, onConfirm } =
    route.params;

  const useDustUtxo =
    useAppSelector((s) => s.settings.advancedSettings?.useDustUtxo) ?? true;

  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allUtxos, setAllUtxos] = useState<ICoinControlListItem[]>([]);
  const [utxosWithoutDust, setUtxosWithoutDust] = useState<
    ICoinControlListItem[]
  >([]);
  const [utxosDust, setUtxosDust] = useState<ICoinControlListItem[]>([]);
  const [frozenUtxos, setFrozenUtxos] = useState<ICoinControlListItem[]>([]);
  const [selectedUtxos, setSelectedUtxos] = useState<string[]>(
    isSelectMode && encodedTx
      ? encodedTx.inputs.map((input) => getUtxoUniqueKey(input))
      : [],
  );

  const [blockTimeMap, setBlockTimeMap] = useState<Record<string, number>>({});
  const [token, setToken] = useState<Token>();

  const { network } = useNetwork({ networkId });

  const {
    menuSortByIndex,
    menuInfoIndex,
    onSortByChange,
    onInfoChange,
    showPath,
    sortMethod,
  } = useCoinControlListMenu();

  const targetAmount = useMemo(
    () => encodedTx?.transferInfo.amount ?? '0',
    [encodedTx?.transferInfo.amount],
  );

  const refreshUtxosData = useCallback(() => {
    setIsLoading(true);
    return backgroundApiProxy.serviceUtxos
      .getUtxos(networkId, accountId, sortMethod)
      .then((response) => {
        setAllUtxos(response.utxos);
        setUtxosWithoutDust(response.utxosWithoutDust);
        setUtxosDust(response.utxosDust);
        setFrozenUtxos(response.frozenUtxos);
        return response.utxos;
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [networkId, accountId, sortMethod]);

  const [config, setConfig] = useState<{
    availabelListCurrentPage: number;
    frozenListCurrentPage: number;
  }>({
    availabelListCurrentPage: 1,
    frozenListCurrentPage: 1,
  });

  const availabelListDataSource = useMemo(() => {
    if (useDustUtxo) {
      const data = utxosWithoutDust.map((item, index) => ({
        ...item,
        dustSeparator:
          index === utxosWithoutDust.length - 1 && utxosDust.length > 0,
      })) as ICoinControlListItem[];
      return data.concat(utxosDust);
    }
    return utxosWithoutDust;
  }, [utxosWithoutDust, utxosDust, useDustUtxo]);

  const frozenListDataSource = useMemo(() => {
    if (!useDustUtxo) {
      const data = frozenUtxos.map((item, index) => ({
        ...item,
        dustSeparator: index === frozenUtxos.length - 1 && utxosDust.length > 0,
      })) as ICoinControlListItem[];
      const dustsData = utxosDust.map((item) => ({
        ...item,
        hideFrozenOption: true,
      }));
      return data.concat(dustsData);
    }
    return frozenUtxos;
  }, [frozenUtxos, utxosDust, useDustUtxo]);
  const showDustListHeader = useMemo(
    () => utxosDust.length > 0 && !useDustUtxo && frozenUtxos.length <= 0,
    [frozenUtxos, useDustUtxo, utxosDust],
  );

  useEffect(() => {
    refreshUtxosData();
  }, [menuSortByIndex, refreshUtxosData]);

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
      availabelListDataSource.length > 0 &&
      availabelListDataSource.every((utxo) =>
        selectedUtxos.includes(getUtxoUniqueKey(utxo)),
      ),
    [selectedUtxos, availabelListDataSource],
  );

  const [, setIsSelectedAllInner] = useState(false);
  const triggerAllSelected = useCallback(
    (value: boolean) => {
      setIsSelectedAllInner(value);
      if (value) {
        setSelectedUtxos(
          availabelListDataSource.map((utxo) => getUtxoUniqueKey(utxo)),
        );
      } else {
        setSelectedUtxos([]);
      }
    },
    [availabelListDataSource],
  );

  useEffect(() => {
    if (
      selectedUtxos.some((key) =>
        frozenUtxos.find((utxo) => getUtxoUniqueKey(utxo) === key),
      )
    ) {
      setSelectedUtxos((prev) =>
        prev.filter(
          (key) => !frozenUtxos.find((utxo) => getUtxoUniqueKey(utxo) === key),
        ),
      );
    }
  }, [frozenUtxos, selectedUtxos]);

  const onCheckBoxChange = useCallback(
    (item: ICoinControlListItem) => {
      const key = getUtxoUniqueKey(item);
      if (selectedUtxos.includes(key)) {
        setSelectedUtxos((prevSelectedUtxos) =>
          prevSelectedUtxos.filter((utxoKey) => utxoKey !== key),
        );
      } else {
        setSelectedUtxos((prevSelectedUtxos) => [...prevSelectedUtxos, key]);
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

  const onFrozenUTXO = useCallback(
    (item: ICoinControlListItem, value: boolean) => {
      backgroundApiProxy.serviceUtxos
        .updateFrozen(networkId, accountId, item, value)
        .then(() => {
          ToastManager.show(
            {
              title: intl.formatMessage({
                id: value
                  ? 'msg__utxo_is_frozen_you_can_find_it_in_frozen_tab'
                  : 'msg__utxo_is_unfrozen_you_can_find_it_in_availabel_tab',
              }),
            },
            {
              type: 'default',
            },
          );
          refreshUtxosData();
        });
    },
    [networkId, accountId, refreshUtxosData, intl],
  );

  const renderEmpty = useMemo(
    () => (
      <Center flex={1}>
        <Empty
          emoji="🕳️"
          title={intl.formatMessage({
            id: 'content__no_coins',
          })}
          subTitle={intl.formatMessage({
            id: 'content__no_utxos_in_this_account',
          })}
        />
      </Center>
    ),
    [intl],
  );

  const showAvailableList = useMemo(
    () => utxosWithoutDust.length > 0 || utxosDust.length > 0,
    [utxosWithoutDust, utxosDust],
  );
  const showAvailableListCheckbox = useMemo(() => isSelectMode, [isSelectMode]);
  // const showAvailableListCheckbox = useMemo(() => true, []);
  const showFrozenList = useMemo(
    () => frozenUtxos.length > 0 || (!useDustUtxo && utxosDust.length > 0),
    [frozenUtxos, useDustUtxo, utxosDust],
  );
  const showFrozenListCheckbox = useMemo(() => false, []);

  return (
    <Modal
      header={
        isSelectMode
          ? intl.formatMessage({ id: 'title__coin_control' })
          : 'UTXOs'
      }
      headerDescription={<ModalHeader networkId={networkId} />}
      height="80%"
      rightContent={
        <CoinControlListMenu
          sortByIndex={menuSortByIndex}
          onSortByChange={onSortByChange}
          infoIndex={menuInfoIndex}
          onInfoChange={onInfoChange}
        >
          <IconButton
            type="plain"
            size="lg"
            circle
            name="EllipsisVerticalOutline"
          />
        </CoinControlListMenu>
      }
      footer={
        isSelectMode ? (
          <ModalFooter
            accountId={accountId}
            network={network}
            token={token}
            allUtxos={allUtxos}
            dustUtxos={utxosDust}
            selectedUtxos={selectedUtxos}
            targetAmount={targetAmount}
            encodedTx={encodedTx}
            isLoading={isLoading}
            onConfirm={onConfirm}
          />
        ) : null
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

      {isLoading ? (
        <Center h="full" pb={6}>
          <Spinner size="lg" />
        </Center>
      ) : null}

      {!isLoading &&
        selectedIndex === 0 &&
        (showAvailableList ? (
          <CoinControlList
            type="Available"
            config={config}
            setConfig={setConfig}
            accountId={accountId}
            network={network as unknown as Network}
            token={token}
            dataSource={availabelListDataSource}
            showDustListHeader={false}
            showCheckbox={showAvailableListCheckbox}
            selectedUtxos={selectedUtxos}
            isAllSelected={isAllSelected}
            triggerAllSelected={triggerAllSelected}
            blockTimeMap={blockTimeMap}
            showPath={showPath}
            onChange={onCheckBoxChange}
            onConfirmEditLabel={onConfirmEditLabel}
            onFrozenUTXO={onFrozenUTXO}
          />
        ) : (
          renderEmpty
        ))}

      {!isLoading &&
        selectedIndex === 1 &&
        (showFrozenList ? (
          <CoinControlList
            type="Frozen"
            config={config}
            setConfig={setConfig}
            accountId={accountId}
            network={network as unknown as Network}
            token={token}
            dataSource={frozenListDataSource}
            showDustListHeader={showDustListHeader}
            showCheckbox={showFrozenListCheckbox}
            selectedUtxos={selectedUtxos}
            isAllSelected={isAllSelected}
            triggerAllSelected={triggerAllSelected}
            blockTimeMap={blockTimeMap}
            showPath={showPath}
            onChange={onCheckBoxChange}
            onConfirmEditLabel={onConfirmEditLabel}
            onFrozenUTXO={onFrozenUTXO}
          />
        ) : (
          renderEmpty
        ))}
    </Modal>
  );
};

export default CoinControl;
