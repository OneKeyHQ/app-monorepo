import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  IconButton,
  Modal,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccount, useNetwork } from '../../hooks';
import { showDialog } from '../../utils/overlayUtils';
import BaseMenu from '../Overlay/BaseMenu';

import { InscriptionList } from './InscriptionList';
import { RecycleDialog } from './RecycleDialog';

import type { InscriptionControlRoutesParams } from '../../routes/Root/Modal/InscriptionControl';
import type { InscriptionControlModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  InscriptionControlRoutesParams,
  InscriptionControlModalRoutes.InscriptionControlModal
>;

function InscriptionControl() {
  const route = useRoute<RouteProps>();
  const intl = useIntl();

  const { accountId, networkId, token } = route.params;

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedInscriptions, setSelectedInscriptions] = useState<string[]>(
    [],
  );

  const [isLoadingInscriptions, setIsLoadingInscriptions] = useState(false);
  const [availableInscriptions, setAvailableInscriptions] = useState<
    NFTBTCAssetModel[]
  >([]);

  const { account } = useAccount({ accountId, networkId });
  const { network } = useNetwork({ networkId });

  const fetchAvailableInscriptions = useCallback(async () => {
    if (networkId && account && token) {
      setIsLoadingInscriptions(true);
      const resp = await backgroundApiProxy.serviceBRC20.getBRC20Inscriptions({
        networkId,
        address: account.address,
        xpub: account.xpub ?? '',
        tokenAddress: token.tokenIdOnNetwork ?? token.address,
      });
      setAvailableInscriptions(resp.availableInscriptions);
      setIsLoadingInscriptions(false);
    }
  }, [account, networkId, token]);

  const handleRecycleOnPress = useCallback(() => {
    const selectedAmount = availableInscriptions
      .filter((item) => selectedInscriptions.includes(item.inscription_id))
      .reduce(
        (acc, item) => new BigNumber(acc).plus(item.output_value_sat).toFixed(),
        '0',
      );

    showDialog(
      <RecycleDialog
        amount={`${new BigNumber(selectedAmount)
          .shiftedBy(-(network?.decimals ?? 0))
          .toFixed()} ${network?.symbol ?? ''}`}
        onConfirm={async () => {
          setIsSelectMode(false);

          const inscriptions = availableInscriptions.filter((item) =>
            selectedInscriptions.includes(item.inscription_id),
          );

          for (let i = 0, len = inscriptions.length; i < len; i += 1) {
            const inscription = inscriptions[i];
            const [txid, vout] = inscription.output.split(':');
            const voutNum = parseInt(vout, 10);
            await backgroundApiProxy.serviceUtxos.updateRecycle({
              networkId,
              accountId,
              utxo: {
                txid,
                vout: voutNum,
                address: inscription.owner,
                value: String(inscription.output_value_sat),
                path: '',
                height: NaN,
              },
              recycle: true,
            });
          }

          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'msg__inscription_deoccupied' }),
            },
            {
              type: ToastManagerType.default,
            },
          );
          fetchAvailableInscriptions();
          setSelectedInscriptions([]);
          appUIEventBus.emit(AppUIEventBusNames.InscriptionRecycleChanged);
        }}
      />,
    );
  }, [
    accountId,
    availableInscriptions,
    fetchAvailableInscriptions,
    intl,
    network?.decimals,
    network?.symbol,
    networkId,
    selectedInscriptions,
  ]);

  const renderFooter = useCallback(() => {
    if (!isSelectMode) return null;

    return (
      <Box paddingX={4} paddingBottom={4}>
        <Text typography="Caption" color="text-subdued">
          {intl.formatMessage({
            id: 'content__deoccupy_the_inscriptions_will_reclaim_theattached_utxos_value_toe_the_account_balance_once_these_utxos_are_spent_you_will_permanently_lose_the_inscription_assets',
          })}
        </Text>
        <Button
          isDisabled={selectedInscriptions.length === 0}
          type="destructive"
          size="lg"
          onPress={handleRecycleOnPress}
          mt={4}
        >
          {intl.formatMessage({ id: 'action__deoccupy' })}
        </Button>
      </Box>
    );
  }, [handleRecycleOnPress, intl, isSelectMode, selectedInscriptions.length]);
  const renderHeaderRight = useCallback(() => {
    if (isSelectMode) {
      return (
        <Button
          size="xs"
          onPress={() => {
            setIsSelectMode(false);
            setSelectedInscriptions([]);
          }}
        >
          {intl.formatMessage({ id: 'action__done' })}
        </Button>
      );
    }

    return (
      <BaseMenu
        options={[
          {
            id: 'action__deoccupy',
            onPress: () => setIsSelectMode(true),
            icon: 'RestoreMini',
            variant: 'desctructive',
          },
        ]}
      >
        <IconButton
          iconColor="icon-subdued"
          type="basic"
          size="xs"
          circle
          name="EllipsisVerticalMini"
        />
      </BaseMenu>
    );
  }, [intl, isSelectMode]);

  const renderContent = useCallback(() => {
    if (isLoadingInscriptions)
      return (
        <Center width="full" height="full">
          <Spinner />
        </Center>
      );

    if (!availableInscriptions || availableInscriptions.length === 0) {
      return (
        <Center width="full" height="full">
          <Empty
            emoji="🕳️"
            title={intl.formatMessage({
              id: 'empty__no_data',
            })}
          />
        </Center>
      );
    }

    return (
      <InscriptionList
        accountId={accountId}
        networkId={networkId}
        inscriptions={availableInscriptions ?? []}
        isSelectMode={isSelectMode}
        onRecycleUtxo={fetchAvailableInscriptions}
        selectedInscriptions={selectedInscriptions}
        setSelectedInscriptions={setSelectedInscriptions}
      />
    );
  }, [
    accountId,
    availableInscriptions,
    fetchAvailableInscriptions,
    intl,
    isLoadingInscriptions,
    isSelectMode,
    networkId,
    selectedInscriptions,
  ]);

  useEffect(() => {
    fetchAvailableInscriptions();
  }, [fetchAvailableInscriptions]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__manage_inscriptions' })}
      height="584px"
      closeable={!isSelectMode}
      headerDescription={
        <Text typography="Caption" color="text-subdued">{`${
          token?.name ?? ''
        } (brc20)`}</Text>
      }
      rightContent={renderHeaderRight()}
      footer={renderFooter()}
    >
      {renderContent()}
    </Modal>
  );
}

export { InscriptionControl };
