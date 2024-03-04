import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty, isNil } from 'lodash';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Heading,
  Image,
  Page,
  SizableText,
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
import { Token } from '../../../components/Token';
import { TxDetails } from '../../../components/TxDetails';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalAssetDetailRoutes } from '../router/types';

import type { ITxDetailsProps } from '../../../components/TxDetails';
import type { IModalAssetDetailsParamList } from '../router/types';
import type { RouteProp } from '@react-navigation/core';

function InfoItemGroup({ children, ...rest }: IXStackProps) {
  return (
    <XStack p="$2.5" flexWrap="wrap" {...rest}>
      {children}
    </XStack>
  );
}

function InfoItem({
  label,
  renderContent,
  compact = false,
  ...rest
}: {
  label: string;
  renderContent: ReactNode;
  compact?: boolean;
} & IStackProps) {
  return (
    <Stack
      flex={1}
      flexBasis="100%"
      p="$2.5"
      space="$2"
      {...(compact && {
        $gtMd: {
          flexBasis: '50%',
        },
      })}
      {...rest}
    >
      <SizableText size="$bodyMdMedium">{label}</SizableText>
      {typeof renderContent === 'string' ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {renderContent}
        </SizableText>
      ) : (
        renderContent
      )}
    </Stack>
  );
}

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

  const { data: txDetails, tokens = {}, nfts = {} } = txDetailsResp ?? {};

  const relatedAssetInfo = useMemo(() => {
    if (!txDetails) return undefined;
    const tokenAddress =
      txDetails.sends[0]?.token || txDetails.receives[0]?.token;

    return getOnChainHistoryTxAssetInfo({
      tokenAddress,
      tokens,
      nfts,
    });
  }, [nfts, tokens, txDetails]);

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

  console.log(txDetails);

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
        <Stack pt={240} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    return (
      // <Stack>
      //   {historyTx.decodedTx.status === EDecodedTxStatus.Pending && (
      //     <>
      //       <ListItem icon="ClockTimeHistoryOutline" title="Pending">
      //         <Button size="small" variant="tertiary">
      //           Cancel
      //         </Button>
      //         <Button size="small" variant="primary" ml="$1">
      //           Speed Up
      //         </Button>
      //       </ListItem>
      //       <Divider mb="$5" pt="$3" />
      //     </>
      //   )}
      //   <TxDetails
      //     details={details}
      //     isUTXO={vaultSettings?.isUtxo}
      //     onViewUTXOsPress={handleOnViewUTXOsPress}
      //   />
      // </Stack>
      <>
        {/* Part 1: What change */}
        <Stack>
          <ListItem>
            <Token
              tokenImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png"
              chainImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png"
            />
            <ListItem.Text primary="USDC" secondary="Polygon" flex={1} />
            <ListItem.Text
              primary="-1000"
              secondary="$1,000.00"
              align="right"
            />
          </ListItem>
          <ListItem>
            <Token
              tokenImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png"
              chainImageUri="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png"
            />
            <ListItem.Text primary="USDC" secondary="Polygon" flex={1} />
            <ListItem.Text
              primary="+1000"
              primaryTextProps={{
                color: '$textSuccess',
              }}
              secondary="$1,000.00"
              align="right"
            />
          </ListItem>
        </Stack>

        {/* Part 2: Details */}
        <Stack>
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem
              label="Status"
              renderContent={
                <XStack h="$5" alignItems="center">
                  <SizableText size="$bodyMdMedium" color="$textCaution">
                    Pending
                  </SizableText>
                  <XStack ml="$5">
                    <Button size="small" variant="primary">
                      Speed Up
                    </Button>
                    <Button size="small" variant="secondary" ml="$2.5">
                      Cancel
                    </Button>
                  </XStack>
                </XStack>
              }
              compact
            />
            <InfoItem
              label="Date"
              renderContent="Jan 23 2024, 19:52:47"
              compact
            />
          </InfoItemGroup>
          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label="From"
              renderContent="0x50c0b7cdcb92151a7764075ee678966cbd1c7a9f"
            />
            <InfoItem
              label="To"
              renderContent="0x50c0b7cdcb92151a7764075ee678966cbd1c7a9f"
            />
            <InfoItem
              label="Transaction ID"
              renderContent="0x76ec773e76d4d84ecb43ad4336eca1aa77cf5ab49f99b1d29a237b385e4163cb"
            />
            <InfoItem
              label="Network Fee"
              renderContent="0.0004087 ETH ($0.99)"
              compact
            />
            <InfoItem
              label="Block Confirmation"
              renderContent="112524"
              compact
            />
          </InfoItemGroup>
          {/* Tertiary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label="Rate"
              renderContent="1 ETH = 2229.259 USDC"
              compact
            />
            <InfoItem
              label="Application"
              renderContent={
                <XStack>
                  <Image src="https://cdn.1inch.io/logo.png" w="$5" h="$5" />
                  <SizableText size="$bodyMd" color="$textSubdued" pl="$1.5">
                    1inch
                  </SizableText>
                </XStack>
              }
              compact
            />
            <InfoItem label="Protocol Fee" renderContent="$0.12" compact />
            <InfoItem
              label="OneKey Fee"
              renderContent="0.3% (0.002 ETH)"
              compact
            />
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    resp.isLoading,
    historyTx.decodedTx.status,
    details,
    vaultSettings?.isUtxo,
    handleOnViewUTXOsPress,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle="transactionType" />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
