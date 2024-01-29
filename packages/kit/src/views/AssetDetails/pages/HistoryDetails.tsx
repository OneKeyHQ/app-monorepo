import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { format } from 'date-fns';
import { isEmpty, isNil } from 'lodash';

import {
  Button,
  Divider,
  Heading,
  Image,
  ListItem,
  Page,
  Spinner,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
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

  const resp = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceAccount.getIsUTXOAccount({ networkId }),
        backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
          networkId,
          accountAddress,
          txid: historyTx.decodedTx.txid,
        }),
      ]),
    [accountAddress, historyTx.decodedTx.txid, networkId],
    { watchLoading: true },
  );

  const [network, isUTXO, txDetailsResp] = resp.result ?? [];

  const { data: txDetails, tokens = {} } = txDetailsResp ?? {};

  const nativeToken = usePromiseResult(
    () => backgroundApiProxy.serviceToken.getNativeToken({ networkId }),
    [networkId],
  ).result;

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
          onPress: () => Toast.success({ title: 'Copied' }),
        },
        {
          key: 'content__to',
          value: txDetails.to,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
      ],
      [
        {
          key: 'content__asset',
          value: relatedAssetInfo?.symbol,
          imgUrl: relatedAssetInfo?.image,
        },
        {
          key: 'content__contract_address',
          value: relatedAssetInfo?.address,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
      ],
      [
        {
          key: 'content__hash',
          value: txDetails.tx,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
        {
          key: 'content__time',
          value: format(new Date(txDetails.timestamp * 1000), 'PPpp'),
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
    nativeToken?.symbol,
    network?.logoURI,
    network?.name,
    relatedAssetInfo?.address,
    relatedAssetInfo?.image,
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
            uri: relatedAssetInfo?.image,
          }}
        />
        <Heading pl="$2" size="$headingLg">
          {txDetails?.label.label}
        </Heading>
      </XStack>
    ),
    [relatedAssetInfo?.image, txDetails?.label.label],
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
          isUTXO={isUTXO}
          onViewUTXOsPress={handleOnViewUTXOsPress}
        />
      </Stack>
    );
  }, [
    resp.isLoading,
    historyTx.decodedTx.status,
    details,
    isUTXO,
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
