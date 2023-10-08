import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  HStack,
  Icon,
  Text,
  VStack,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { IBtcUTXO } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';

import OrdinalsSVG from '../../components/SVG/OrdinalsSVG';
import { useNetwork } from '../../hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../routes/routesEnum';

import { getInscriptionsInActions, getInscriptionsInUtxo } from './utils';

type Props = {
  title: string;
  utxos: Partial<IBtcUTXO>[];
  decodedTx: IDecodedTx;
  type: 'inputs' | 'outputs';
  style?: ComponentProps<typeof Box>;
};

const MAX_UTXOS_DEFAULT = 5;

function TxUtxoDetailBlock(props: Props) {
  const { title, utxos, style, decodedTx, type } = props;
  const [showAll, setShowAll] = useState(false);
  const navigation = useNavigation();
  const intl = useIntl();
  const { networkId, accountId, actions, encodedTx } = decodedTx;
  const { network } = useNetwork({ networkId });

  const utxosToShow = showAll ? utxos : utxos.slice(0, MAX_UTXOS_DEFAULT);

  const isListOrderPsbt = useMemo(() => {
    const totalFee = new BigNumber(
      (encodedTx as IEncodedTxBtc)?.totalFee ?? '0',
    );

    return !!(
      (encodedTx as IEncodedTxBtc)?.psbtHex &&
      (totalFee.isNaN() || totalFee.isLessThanOrEqualTo(0))
    );
  }, [encodedTx]);

  const renderInscriptions = useCallback(
    (inscriptions: NFTBTCAssetModel[]) => (
      <HStack space={1} flexWrap="wrap">
        {inscriptions.map((inscription) => (
          <Pressable
            key={inscription.inscription_id}
            px="6px"
            py="2px"
            borderRadius="4px"
            bgColor="surface-subdued"
            mb={1}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendModalRoutes.NFTDetailModal,
                  params: {
                    asset: inscription,
                    networkId,
                    accountId,
                    isOwner: false,
                  },
                },
              });
            }}
          >
            <HStack alignItems="center" space={1}>
              <OrdinalsSVG />
              <Text typography="Body2Strong">
                #{inscription.inscription_number}
              </Text>
            </HStack>
          </Pressable>
        ))}
      </HStack>
    ),
    [accountId, navigation, networkId],
  );

  const renderUtxos = useCallback(() => {
    const { inscriptions: inscriptionsInActions, inscriptionsInSameUtxo } =
      getInscriptionsInActions(actions);
    let restInscriptions = inscriptionsInActions;

    return utxosToShow.map((utxo, index) => {
      const result = getInscriptionsInUtxo({
        utxo,
        inscriptionsInActions: restInscriptions,
        inscriptionsInSameUtxo,
        isListOrderPsbt,
        type,
      });
      const { inscriptions } = result;
      restInscriptions = result.restInscriptions;
      return (
        <HStack key={utxo.txid ?? index} space={2}>
          <Text typography="Body2Mono" color="text-subdued">
            #{index}
          </Text>
          <VStack flex={1}>
            {renderInscriptions(inscriptions)}
            <Text typography="Body2Strong">{utxo.address}</Text>
            <Text typography="Body2" color="text-subdued">
              {new BigNumber(utxo.value ?? '0')
                .shiftedBy(-(network?.decimals ?? 0))
                .toFixed()}{' '}
              {network?.symbol}
            </Text>
          </VStack>
        </HStack>
      );
    });
  }, [
    actions,
    isListOrderPsbt,
    network?.decimals,
    network?.symbol,
    renderInscriptions,
    type,
    utxosToShow,
  ]);

  return (
    <Box {...style}>
      <Text
        typography="Subheading"
        textTransform="uppercase"
        mb={3}
        color="text-subdued"
      >
        {title}
      </Text>
      <Box
        borderRadius="12px"
        borderWidth={1}
        borderColor="border-subdued"
        padding={4}
        bgColor="surface-default"
      >
        <VStack space={2}>{renderUtxos()}</VStack>
        {utxos.length > MAX_UTXOS_DEFAULT ? (
          <>
            <Divider mt={2} />
            <Button
              rightIcon={
                <Icon
                  size={12}
                  name={showAll ? 'ChevronUpMini' : 'ChevronDownMini'}
                  color="icon-subdued"
                />
              }
              type="plain"
              size="sm"
              mt={2}
              onPress={() => setShowAll(!showAll)}
            >
              <Text
                typography="Body1Strong"
                fontSize="14px"
                color="text-subdued"
              >
                {intl.formatMessage({
                  id: showAll ? 'action__show_less' : 'action__show_all',
                })}
              </Text>
            </Button>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

export { TxUtxoDetailBlock };
