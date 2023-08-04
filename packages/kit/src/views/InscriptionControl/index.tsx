import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  IconButton,
  Modal,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccount } from '../../hooks';
import { useBRC20Inscriptions } from '../../hooks/useBRC20Inscriptions';
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

  const { account } = useAccount({ accountId, networkId });

  const {
    isLoading,
    availableInscriptions = [],
    fetchBRC20Inscriptions,
  } = useBRC20Inscriptions({
    networkId,
    address: account?.address,
    xpub: isTaprootXpubSegwit(account?.xpub ?? '')
      ? getTaprootXpub(account?.xpub ?? '')
      : account?.xpub,
    tokenAddress: token?.tokenIdOnNetwork ?? token?.address,
  });

  const handleRecycleOnPress = useCallback(() => {
    showDialog(
      <RecycleDialog
        onConfirm={async () => {
          setIsSelectMode(false);

          const inscriptions = availableInscriptions.filter((item) =>
            selectedInscriptions.includes(item.inscription_id),
          );

          await Promise.all(
            inscriptions.map((inscription) => {
              const [txid, vout] = inscription.output.split(':');
              const voutNum = parseInt(vout, 10);
              return backgroundApiProxy.serviceUtxos.updateRecycle({
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
            }),
          );

          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'msg__inscription_destroyed' }),
            },
            {
              type: 'default',
            },
          );
          fetchBRC20Inscriptions();
          setSelectedInscriptions([]);
        }}
      />,
    );
  }, [
    accountId,
    availableInscriptions,
    fetchBRC20Inscriptions,
    intl,
    networkId,
    selectedInscriptions,
  ]);

  const renderFooter = useCallback(() => {
    if (!isSelectMode) return null;

    return (
      <Box paddingX={4} paddingBottom={4}>
        <Text typography="Caption" color="text-subdued">
          {intl.formatMessage({
            id: 'content__destroying_the_inscriptions_will_reclaim_theattached_utxos_value_toe_the_account_balance_once_these_utxos_are_spent_you_will_permanently_lose_the_inscription_assets',
          })}
        </Text>
        <Button
          isDisabled={selectedInscriptions.length === 0}
          type="destructive"
          size="lg"
          onPress={handleRecycleOnPress}
          mt={4}
        >
          {intl.formatMessage({ id: 'action__destroy' })}
        </Button>
      </Box>
    );
  }, [handleRecycleOnPress, intl, isSelectMode, selectedInscriptions.length]);
  const renderHeaderRight = useCallback(() => {
    if (isSelectMode) {
      return (
        <IconButton
          iconColor="icon-subdued"
          circle
          name="CheckMini"
          type="basic"
          size="xs"
          onPress={() => {
            setIsSelectMode(false);
            setSelectedInscriptions([]);
          }}
        />
      );
    }

    return (
      <BaseMenu
        menuWidth="full"
        options={[
          {
            id: 'action__bulk_destroy',
            onPress: () => setIsSelectMode(true),
            icon: 'FireSolid',
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
  }, [isSelectMode]);

  const renderContent = useCallback(() => {
    if (isLoading)
      return (
        <Center width="full" height="full">
          <Spinner />
        </Center>
      );

    return (
      <InscriptionList
        accountId={accountId}
        networkId={networkId}
        inscriptions={availableInscriptions ?? []}
        isSelectMode={isSelectMode}
        selectedInscriptions={selectedInscriptions}
        setSelectedInscriptions={setSelectedInscriptions}
      />
    );
  }, [
    accountId,
    availableInscriptions,
    isLoading,
    isSelectMode,
    networkId,
    selectedInscriptions,
  ]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__manage_inscriptions' })}
      height="584px"
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
