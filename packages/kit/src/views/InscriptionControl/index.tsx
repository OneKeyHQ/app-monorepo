import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Divider,
  HStack,
  IconButton,
  Modal,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';

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
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';

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
    mutate,
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

          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__success' }),
          });
          mutate();
          setSelectedInscriptions([]);
        }}
      />,
    );
  }, [
    accountId,
    availableInscriptions,
    intl,
    mutate,
    networkId,
    selectedInscriptions,
  ]);

  const renderFooter = useCallback(() => {
    const totalSats = availableInscriptions?.reduce(
      (acc, cur) => new BigNumber(acc).plus(cur.output_value_sat).toFixed(),
      '0',
    );

    return (
      <Box paddingX={4} paddingBottom={4}>
        <Divider mb={2} />
        <HStack alignItems="center">
          <Text typography="Subheading" color="text-subdued" numberOfLines={2}>
            {intl.formatMessage(
              { id: 'form__str_items__uppercase' },
              { 0: availableInscriptions?.length ?? '0' },
            )}
          </Text>
          <Text
            flex={1}
            textAlign="right"
            typography="CaptionStrong"
            color="text-subdued"
            numberOfLines={2}
          >
            {totalSats} sats
          </Text>
        </HStack>
        <Text typography="Caption" color="text-subdued" mt={2}>
          回收铭文会将其附着的 UTXO
          释放到您的账户余额，下次转账时会自动花费，一旦被花费，您将永久失去该铭文资产。
        </Text>
        {isSelectMode ? (
          <Button
            isDisabled={selectedInscriptions.length === 0}
            type="destructive"
            size="lg"
            onPress={handleRecycleOnPress}
            mt={6}
          >
            Recycle
          </Button>
        ) : null}
      </Box>
    );
  }, [
    handleRecycleOnPress,
    availableInscriptions,
    intl,
    isSelectMode,
    selectedInscriptions.length,
  ]);
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
            textValue: 'Recycle to account balance',
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
      header="Manage Inscriptions"
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
