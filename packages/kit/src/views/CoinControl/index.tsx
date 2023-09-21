import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
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
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

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
  const [frozenUtxosWithoutRecycle, setFrozenUtxosWithoutRecycle] = useState<
    ICoinControlListItem[]
  >([]);
  const [frozenRecycleUtxos, setFrozenRecycleUtxos] = useState<
    ICoinControlListItem[]
  >([]);
  const [recycleUtxosWithoutFrozen, setRecycleUtxosWithoutFrozen] = useState<
    ICoinControlListItem[]
  >([]);
  const [selectedUtxos, setSelectedUtxos] = useState<string[]>(
    isSelectMode && encodedTx
      ? encodedTx.inputs.map((input) => getUtxoUniqueKey(input))
      : [],
  );

  const [blockTimeMap, setBlockTimeMap] = useState<Record<string, number>>({});
  const [token, setToken] = useState<Token>();

  const { network } = useNetwork({ networkId });

  const dust = useMemo(
    () =>
      new BigNumber(
        (network?.settings.dust ?? network?.settings.minTransferAmount) || 0,
      ).shiftedBy(network?.decimals ?? 0),
    [
      network?.decimals,
      network?.settings.dust,
      network?.settings.minTransferAmount,
    ],
  );

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

  const useCustomAddressesBalance = useMemo(
    () => !!encodedTx?.transferInfo.useCustomAddressesBalance,
    [encodedTx?.transferInfo.useCustomAddressesBalance],
  );

  const refreshUtxosData = useCallback(async () => {
    setIsLoading(true);

    return backgroundApiProxy.serviceUtxos
      .getUtxos({
        networkId,
        accountId,
        sortBy: sortMethod,
        useRecycleUtxos: true,
        useCustomAddressesBalance,
      })
      .then((response) => {
        setAllUtxos(response.utxos);
        setUtxosWithoutDust(response.utxosWithoutDust);
        setUtxosDust(response.utxosDust);
        setFrozenUtxos(response.frozenUtxos);
        setFrozenUtxosWithoutRecycle(response.frozenUtxosWithoutRecycle);
        setFrozenRecycleUtxos(response.frozenRecycleUtxos);
        setRecycleUtxosWithoutFrozen(response.recycleUtxosWithoutFrozen);
        return response.utxos;
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [networkId, accountId, sortMethod, useCustomAddressesBalance]);

  const [config, setConfig] = useState<{
    availabelListCurrentPage: number;
    frozenListCurrentPage: number;
  }>({
    availabelListCurrentPage: 1,
    frozenListCurrentPage: 1,
  });

  const availabelListDataSource = useMemo(() => {
    if (useDustUtxo) {
      let data = utxosWithoutDust.map((item, index) => ({
        ...item,
        dustSeparator:
          index === utxosWithoutDust.length - 1 && utxosDust.length > 0,
        recycleSeparator:
          index === utxosWithoutDust.length - 1 &&
          utxosDust.length === 0 &&
          recycleUtxosWithoutFrozen.length > 0,
      })) as ICoinControlListItem[];
      data = data.concat(
        utxosDust.map((item, index) => ({
          ...item,
          recycleSeparator:
            index === utxosDust.length - 1 &&
            recycleUtxosWithoutFrozen.length > 0,
        })),
      );

      return data.concat(recycleUtxosWithoutFrozen);
    }

    const recycleUtxosWithoutDustAndFrozen = recycleUtxosWithoutFrozen.filter(
      (utxo) => new BigNumber(utxo.value).isGreaterThan(dust),
    );

    const data = utxosWithoutDust.map((item, index) => ({
      ...item,
      recycleSeparator:
        index === utxosWithoutDust.length - 1 &&
        recycleUtxosWithoutDustAndFrozen.length > 0,
    })) as ICoinControlListItem[];

    return data.concat(recycleUtxosWithoutDustAndFrozen);
  }, [
    useDustUtxo,
    recycleUtxosWithoutFrozen,
    utxosWithoutDust,
    utxosDust,
    dust,
  ]);

  const frozenListDataSource = useMemo(() => {
    if (!useDustUtxo) {
      const recycleDustUtxosWithoutFrozen = recycleUtxosWithoutFrozen.filter(
        (utxo) => new BigNumber(utxo.value).isLessThanOrEqualTo(dust),
      );

      const frozenRecycleUtxosWithoutDust = frozenRecycleUtxos.filter((utxo) =>
        new BigNumber(utxo.value).isGreaterThan(dust),
      );

      let data = frozenUtxosWithoutRecycle.map((item, index) => ({
        ...item,
        dustSeparator:
          index === frozenUtxosWithoutRecycle.length - 1 &&
          utxosDust.length > 0,
        recycleSeparator:
          index === frozenUtxosWithoutRecycle.length - 1 &&
          utxosDust.length === 0 &&
          [...recycleDustUtxosWithoutFrozen, ...frozenRecycleUtxosWithoutDust]
            .length > 0,
      })) as ICoinControlListItem[];

      data = data.concat(
        utxosDust.map((item, index) => ({
          ...item,
          hideFrozenOption: true,
          recycleSeparator:
            index === utxosDust.length - 1 &&
            [...recycleDustUtxosWithoutFrozen, ...frozenRecycleUtxosWithoutDust]
              .length > 0,
        })),
      );

      data = data.concat(
        recycleDustUtxosWithoutFrozen.map((item) => ({
          ...item,
          hideFrozenOption: true,
        })),
      );
      return data.concat(frozenRecycleUtxosWithoutDust);
    }

    const frozenDustUtxo = frozenUtxosWithoutRecycle.filter((item) =>
      new BigNumber(item.value).isLessThanOrEqualTo(dust),
    );

    const frozenUtxoWithoutDust = frozenUtxosWithoutRecycle.filter((item) =>
      new BigNumber(item.value).isGreaterThan(dust),
    );

    let data = frozenUtxoWithoutDust.map((item, index) => ({
      ...item,
      dustSeparator:
        index === frozenUtxoWithoutDust.length - 1 && frozenDustUtxo.length > 0,
      recycleSeparator:
        index === frozenUtxoWithoutDust.length - 1 &&
        frozenRecycleUtxos.length > 0 &&
        frozenDustUtxo.length === 0,
    })) as ICoinControlListItem[];

    data = data.concat(
      frozenDustUtxo.map((item, index) => ({
        ...item,
        recycleSeparator:
          index === frozenDustUtxo.length - 1 && frozenRecycleUtxos.length > 0,
      })),
    );

    return data.concat(frozenRecycleUtxos);
  }, [
    useDustUtxo,
    frozenUtxosWithoutRecycle,
    frozenRecycleUtxos,
    recycleUtxosWithoutFrozen,
    utxosDust,
    dust,
  ]);

  const showAvailableListDustHeader = useMemo(
    () =>
      useDustUtxo
        ? utxosDust.length > 0 && utxosWithoutDust.length <= 0
        : false,
    [useDustUtxo, utxosDust.length, utxosWithoutDust.length],
  );

  const showFrozenListDustHeader = useMemo(() => {
    if (useDustUtxo) {
      const frozenDustUtxo = frozenUtxosWithoutRecycle.filter((item) =>
        new BigNumber(item.value).isLessThanOrEqualTo(dust),
      );

      const frozenUtxoWithoutDust = frozenUtxosWithoutRecycle.filter((item) =>
        new BigNumber(item.value).isGreaterThan(dust),
      );

      return frozenUtxoWithoutDust.length <= 0 && frozenDustUtxo.length > 0;
    }

    return utxosDust.length > 0 && frozenUtxosWithoutRecycle.length <= 0;
  }, [dust, frozenUtxosWithoutRecycle, useDustUtxo, utxosDust.length]);

  const showAvailableListRecycleHeader = useMemo(() => {
    if (useDustUtxo) {
      return (
        recycleUtxosWithoutFrozen.length > 0 &&
        utxosWithoutDust.length <= 0 &&
        utxosDust.length <= 0
      );
    }

    const recycleUtxosWithoutDustAndFrozen = recycleUtxosWithoutFrozen.filter(
      (utxo) => new BigNumber(utxo.value).isGreaterThan(dust),
    );

    return (
      recycleUtxosWithoutDustAndFrozen.length > 0 &&
      utxosWithoutDust.length <= 0
    );
  }, [
    dust,
    recycleUtxosWithoutFrozen,
    useDustUtxo,
    utxosDust.length,
    utxosWithoutDust.length,
  ]);
  const showFrozenListRecycleHeader = useMemo(() => {
    if (useDustUtxo) {
      return (
        frozenRecycleUtxos.length > 0 && frozenUtxosWithoutRecycle.length <= 0
      );
    }

    const recycleDustUtxosWithoutFrozen = recycleUtxosWithoutFrozen.filter(
      (utxo) => new BigNumber(utxo.value).isLessThanOrEqualTo(dust),
    );

    const frozenRecycleUtxosWithoutDust = frozenRecycleUtxos.filter((utxo) =>
      new BigNumber(utxo.value).isGreaterThan(dust),
    );

    return (
      utxosDust.length <= 0 &&
      frozenUtxosWithoutRecycle.length <= 0 &&
      [...recycleDustUtxosWithoutFrozen, ...frozenRecycleUtxosWithoutDust]
        .length > 0
    );
  }, [
    dust,
    frozenRecycleUtxos,
    frozenUtxosWithoutRecycle.length,
    recycleUtxosWithoutFrozen,
    useDustUtxo,
    utxosDust.length,
  ]);

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

  const onRecycleUTXO = useCallback(
    (item: ICoinControlListItem) => {
      backgroundApiProxy.serviceUtxos
        .updateRecycle({
          networkId,
          accountId,
          utxo: item,
          recycle: false,
          frozen: false,
        })
        .then(() => {
          ToastManager.show(
            {
              title: intl.formatMessage({
                id: 'msg__inscription_restored',
              }),
            },
            {
              type: 'default',
            },
          );
          refreshUtxosData();
          appUIEventBus.emit(AppUIEventBusNames.InscriptionRecycleChanged);
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

  const showAvailableListCheckbox = useMemo(() => isSelectMode, [isSelectMode]);
  // const showAvailableListCheckbox = useMemo(() => true, []);
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
        (availabelListDataSource.length ? (
          <CoinControlList
            type="Available"
            config={config}
            setConfig={setConfig}
            accountId={accountId}
            network={network as unknown as Network}
            token={token}
            dataSource={availabelListDataSource}
            showDustListHeader={showAvailableListDustHeader}
            showRecycleListHeader={showAvailableListRecycleHeader}
            showCheckbox={showAvailableListCheckbox}
            selectedUtxos={selectedUtxos}
            isAllSelected={isAllSelected}
            triggerAllSelected={triggerAllSelected}
            blockTimeMap={blockTimeMap}
            showPath={showPath}
            onChange={onCheckBoxChange}
            onConfirmEditLabel={onConfirmEditLabel}
            onFrozenUTXO={onFrozenUTXO}
            onRecycleUTXO={onRecycleUTXO}
          />
        ) : (
          renderEmpty
        ))}
      {!isLoading &&
        selectedIndex === 1 &&
        (frozenListDataSource.length ? (
          <CoinControlList
            type="Frozen"
            config={config}
            setConfig={setConfig}
            accountId={accountId}
            network={network as unknown as Network}
            token={token}
            dataSource={frozenListDataSource}
            showDustListHeader={showFrozenListDustHeader}
            showRecycleListHeader={showFrozenListRecycleHeader}
            showCheckbox={showFrozenListCheckbox}
            selectedUtxos={selectedUtxos}
            isAllSelected={isAllSelected}
            triggerAllSelected={triggerAllSelected}
            blockTimeMap={blockTimeMap}
            showPath={showPath}
            onChange={onCheckBoxChange}
            onConfirmEditLabel={onConfirmEditLabel}
            onFrozenUTXO={onFrozenUTXO}
            onRecycleUTXO={onRecycleUTXO}
          />
        ) : (
          renderEmpty
        ))}
    </Modal>
  );
};

export default CoinControl;
