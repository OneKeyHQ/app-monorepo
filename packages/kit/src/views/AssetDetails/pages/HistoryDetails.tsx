import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty, isNil } from 'lodash';

import {
  Button,
  Divider,
  Heading,
  Image,
  Page,
  Spinner,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { getOnChainHistoryTxAssetInfo } from '@onekeyhq/shared/src/utils/historyUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TxDetails } from '../../../components/TxDetails';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalAssetDetailRoutes } from '../router/types';

import type { ITxDetailsProps } from '../../../components/TxDetails';
import type { IModalAssetDetailsParamList } from '../router/types';
import type { RouteProp } from '@react-navigation/core';

function HistoryDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.HistoryDetails
      >
    >();

  const { networkId, accountAddress, historyTx } = route.params;

  const navigation = useAppNavigation();

  const { copyText } = useClipboard();

  const resp = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
          networkId,
          accountAddress,
          txid: historyTx.decodedTx.txid,
        }),
        backgroundApiProxy.serviceToken.getNativeToken({ networkId }),
      ]),
    [accountAddress, historyTx.decodedTx.txid, networkId],
    { watchLoading: true },
  );

  const [network, vaultSettings, txDetailsResp, nativeToken] =
    resp.result ?? [];

  const { data: txDetails, tokens = {} } = txDetailsResp ?? {};

  const relatedAssetInfo = useMemo(() => {
    if (!txDetails) return undefined;
    const tokenAddress =
      txDetails.sends[0]?.token || txDetails.receives[0]?.token;

    return getOnChainHistoryTxAssetInfo({
      tokenAddress,
      tokens,
    });
  }, [tokens, txDetails]);

  const details = useMemo(() => {
    if (!txDetails) return [];
    return [
      [
        {
          key: 'content__from',
          value: txDetails.from,
          iconAfter: 'Copy1Outline',
          onPress: () => copyText(txDetails.from),
        },
        {
          key: 'content__to',
          value: txDetails.to,
          iconAfter: 'Copy1Outline',
          onPress: () => copyText(txDetails.to),
        },
      ],
      [
        {
          key: 'content__asset',
          value: relatedAssetInfo?.symbol,
          imgUrl: relatedAssetInfo?.icon,
          isNFT: relatedAssetInfo?.isNFT,
        },
        {
          key: 'content__contract_address',
          value: relatedAssetInfo?.address,
          iconAfter: 'Copy1Outline',
          onPress: () => copyText(relatedAssetInfo?.address ?? ''),
        },
      ],
      [
        {
          key: 'content__hash',
          value: txDetails.tx,
          iconAfter: 'Copy1Outline',
          onPress: () => copyText(txDetails.tx),
        },
        {
          key: 'content__time',
          value: formatDate(new Date(txDetails.timestamp * 1000)),
        },
      ],
      [
        {
          key: 'network__network',
          value: network?.name,
          imgUrl: network?.logoURI,
        },
        {
          key: 'content__fee',
          value: `${txDetails.gasFee} ${nativeToken?.symbol ?? ''}`,
        },
        {
          key: 'content__nonce',
          value: txDetails.nonce,
        },
      ],
    ].map((section) =>
      section.filter((item) => !isNil(item.value) && !isEmpty(item.value)),
    ) as ITxDetailsProps['details'];
  }, [
    copyText,
    nativeToken?.symbol,
    network?.logoURI,
    network?.name,
    relatedAssetInfo?.address,
    relatedAssetInfo?.icon,
    relatedAssetInfo?.isNFT,
    relatedAssetInfo?.symbol,
    txDetails,
  ]);

  const handleOnViewUTXOsPress = useCallback(() => {
    if (!txDetails) return;
    const { inputs: onChainInputs, outputs: onChainOutputs } = txDetails;

    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      inputs: onChainInputs?.map((input) => ({
        address: input.addresses[0],
        value: input.value,
      })),
      outputs: onChainOutputs?.map((output) => ({
        address: output.addresses[0],
        value: output.value,
      })),
    });
  }, [navigation, txDetails]);

  const headerTitle = useCallback(
    () => (
      <XStack alignItems="center">
        <Image
          width="$6"
          height="$6"
          source={{
            uri: relatedAssetInfo?.icon,
          }}
          circular={!relatedAssetInfo?.isNFT}
          borderRadius={3}
        />
        <Heading pl="$2" size="$headingLg" textTransform="capitalize">
          {txDetails?.label.label}
        </Heading>
      </XStack>
    ),
    [relatedAssetInfo?.icon, relatedAssetInfo?.isNFT, txDetails?.label.label],
  );

  const renderHistoryDetails = useCallback(() => {
    if (resp.isLoading) {
      return (
        <Stack h="100%" justifyContent="center" alignItems="center">
          <Spinner />
        </Stack>
      );
    }

    return (
      <Stack>
        {historyTx.decodedTx.status === EDecodedTxStatus.Pending && (
          <>
            <ListItem icon="ClockTimeHistoryOutline" title="Pending">
              <Button size="small" variant="tertiary">
                Cancel
              </Button>
              <Button size="small" variant="primary" ml="$1">
                Speed Up
              </Button>
            </ListItem>
            <Divider mb="$5" pt="$3" />
          </>
        )}
        <TxDetails
          details={details}
          isUTXO={vaultSettings?.isUtxo}
          onViewUTXOsPress={handleOnViewUTXOsPress}
        />
      </Stack>
    );
  }, [
    resp.isLoading,
    historyTx.decodedTx.status,
    details,
    vaultSettings?.isUtxo,
    handleOnViewUTXOsPress,
  ]);

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
