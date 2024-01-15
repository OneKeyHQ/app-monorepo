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
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { IProps as ITxDetailsProps } from '../../../components/TxDetails';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '../router/types';
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

  const network = usePromiseResult(
    () => mockGetNetwork({ networkId }),
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
          key: 'From',
          value: txDetails.from,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
        {
          key: 'To',
          value: txDetails.to,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
      ],
      [
        {
          key: 'Token',
          value: relatedAssetInfo?.symbol,
          imgUrl: relatedAssetInfo?.logoURI,
        },
        {
          key: 'Token Contrast',
          value: relatedAssetInfo?.address,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
      ],
      [
        {
          key: 'Hash',
          value: txDetails.tx,
          iconAfter: 'Copy1Outline',
          onPress: () => Toast.success({ title: 'Copied' }),
        },
        {
          key: 'Time',
          value: format(new Date(txDetails.timestamp * 1000), 'PPpp'),
        },
      ],
      [
        {
          key: 'Chain',
          value: network?.name,
          imgUrl: network?.logoURI,
        },
        {
          key: 'Fee',
          value: `${txDetails.gasFee} ${nativeToken?.symbol ?? ''}`,
        },
        {
          key: 'Nonce',
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
        <Stack justifyContent="center" alignItems="center">
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
        <TxDetails details={details} />
      </Stack>
    );
  }, [resp.isLoading, historyTx.decodedTx.status, details]);

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
