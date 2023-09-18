import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';

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

import OrdinalsSVG from '../../components/SVG/OrdinalsSVG';
import { useNetwork } from '../../hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../routes/routesEnum';

import { getInscriptionsInActions } from './utils';

type Props = {
  title: string;
  utxos: Partial<IBtcUTXO>[];
  decodedTx: IDecodedTx;
  style?: ComponentProps<typeof Box>;
};

const MAX_UTXOS_DEFAULT = 5;

function getInscriptionsInUtxo(
  utxo: Partial<IBtcUTXO>,
  inscriptionsInActions: NFTBTCAssetModel[],
) {
  let inscriptions = [];
  let restInscriptions = inscriptionsInActions;

  if (utxo.inscriptions) {
    inscriptions = utxo.inscriptions;
  } else if (utxo.txid) {
    inscriptions = inscriptionsInActions.filter(
      (inscription) => inscription.tx_hash === utxo.txid,
    );
    if (inscriptions.length === 0) {
      const result = inscriptionsInActions.find((inscription) =>
        new BigNumber(inscription.output_value_sat).isEqualTo(utxo.value ?? 0),
      );
      if (result) {
        inscriptions.push(result);
        restInscriptions = restInscriptions.filter(
          (inscription) => inscription.inscription_id !== result.inscription_id,
        );
      }
    }
  } else {
    const result = inscriptionsInActions.find((inscription) =>
      new BigNumber(inscription.output_value_sat).isEqualTo(utxo.value ?? 0),
    );
    if (result) {
      inscriptions.push(result);
      restInscriptions = restInscriptions.filter(
        (inscription) => inscription.inscription_id !== result.inscription_id,
      );
    }
  }

  return {
    inscriptions,
    restInscriptions,
  };
}

function TxUtxoDetailBlock(props: Props) {
  const { title, utxos, style, decodedTx } = props;
  const [showAll, setShowAll] = useState(false);
  const navigation = useNavigation();
  const intl = useIntl();
  const { networkId, accountId, actions } = decodedTx;
  const { network } = useNetwork({ networkId });

  const utxosToShow = showAll ? utxos : utxos.slice(0, MAX_UTXOS_DEFAULT);

  const renderInscriptions = useCallback(
    (inscriptions: NFTBTCAssetModel[]) => (
      <HStack>
        {inscriptions.map((inscription) => (
          <Pressable
            key={inscription.inscription_id}
            px="6px"
            py="2px"
            borderRadius="4px"
            bgColor="surface-subdued"
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
    const inscriptionsInActions = getInscriptionsInActions(actions);
    let restInscriptions = inscriptionsInActions;

    return utxosToShow.map((utxo, index) => {
      const result = getInscriptionsInUtxo(utxo, restInscriptions);
      const { inscriptions } = result;
      restInscriptions = result.restInscriptions;
      return (
        <HStack key={utxo.txid ?? index} space={2} alignItems="start">
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
    network?.decimals,
    network?.symbol,
    renderInscriptions,
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
