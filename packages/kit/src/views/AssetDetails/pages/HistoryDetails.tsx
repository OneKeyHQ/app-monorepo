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
import { mockGetNetwork } from '@onekeyhq/kit-bg/src/mock';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TxDetails } from '../../../components/TxDetails';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalAssetDetailRoutes } from '../router/types';

import type { IProps as ITxDetailsProps } from '../../../components/TxDetails';
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

  const { networkId, historyTx } = route.params;

  const navigation = useAppNavigation();

  const network = usePromiseResult(
    () => mockGetNetwork({ networkId }),
    [networkId],
  ).result;

  const isUTXO = usePromiseResult(
    () => backgroundApiProxy.serviceAccount.getIsUTXOAccount({ networkId }),
    [networkId],
  ).result;

  const resp = usePromiseResult(
    () =>
      backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        networkId,
        txid: historyTx.decodedTx.txid,
      }),
    [historyTx.decodedTx.txid, networkId],
    { watchLoading: true },
  );

  const nativeToken = usePromiseResult(
    () => backgroundApiProxy.serviceToken.getNativeToken(network?.id),
    [network?.id],
  ).result;

  const { data: txDetails } = resp.result ?? {};

  const relatedAssetInfo = useMemo(() => {
    if (!txDetails) return undefined;
    const asset = txDetails.sends[0]?.info || txDetails.receives[0]?.info;

    let assetInfo = {
      address: '',
      logoURI: '',
      symbol: '',
    };

    if ((asset as IAccountNFT)?.itemId) {
      const nft = asset as IAccountNFT;
      assetInfo = {
        address: nft.collectionAddress,
        logoURI: nft.metadata.image,
        symbol: nft.collectionSymbol,
      };
    }
    if ((asset as IToken)?.name) {
      const token = asset as IToken;
      assetInfo = {
        address: token.address,
        logoURI: token.logoURI,
        symbol: token.symbol,
      };
    }

    return assetInfo;
  }, [txDetails]);

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
          imgUrl: relatedAssetInfo?.logoURI,
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
    relatedAssetInfo?.logoURI,
    relatedAssetInfo?.symbol,
    txDetails,
  ]);

  const handleOnViewUTXOsPress = useCallback(() => {
    if (!txDetails) return;
    const { sends, receives } = txDetails;
    navigation.push(EModalAssetDetailRoutes.UTXODetails, {
      inputs: receives.map((receive) => ({
        address: receive.from,
        value: receive.amount,
      })),
      outputs: sends.map((send) => ({
        address: send.to,
        value: send.amount,
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
            uri: relatedAssetInfo?.logoURI,
          }}
        />
        <Heading pl="$2" size="$headingLg">
          {txDetails?.label.label}
        </Heading>
      </XStack>
    ),
    [relatedAssetInfo?.logoURI, txDetails?.label.label],
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
