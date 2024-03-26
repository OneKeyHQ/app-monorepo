import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Divider,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleIds } from '@onekeyhq/shared/src/locale';
import type { IModalAssetDetailsParamList } from '@onekeyhq/shared/src/routes/assetDetails';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import {
  getHistoryTxDetailInfo,
  getOnChainHistoryTxAssetInfo,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { buildTransactionDetailsUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import { type IOnChainHistoryTxTransfer } from '@onekeyhq/shared/types/history';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { openUrl } from '../../../utils/openUrl';

import type { RouteProp } from '@react-navigation/core';
import type { ColorValue } from 'react-native';

function getTxStatusTextProps(status: EDecodedTxStatus): {
  key: ILocaleIds;
  color: ColorValue;
} {
  if (status === EDecodedTxStatus.Pending) {
    return {
      key: 'transaction__pending',
      color: '$textCaution',
    };
  }

  if (status === EDecodedTxStatus.Confirmed) {
    return {
      key: 'transaction__success',
      color: '$textSuccess',
    };
  }

  return {
    key: 'transaction__failed',
    color: '$textCritical',
  };
}

export function InfoItemGroup({ children, ...rest }: IXStackProps) {
  return (
    <XStack p="$2.5" flexWrap="wrap" {...rest}>
      {children}
    </XStack>
  );
}

export function InfoItem({
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

export function AssetItem({
  asset,
  index,
  direction,
  amount,
  networkIcon,
  currencySymbol,
}: {
  asset: {
    name: string;
    symbol: string;
    icon: string;
    isNFT?: boolean;
    isNative?: boolean;
    price: string;
  };
  index: number;
  direction: EDecodedTxDirection;
  amount: string;
  networkIcon: string;
  currencySymbol: string;
}) {
  return (
    <ListItem key={index}>
      <Token
        isNFT={asset.isNFT}
        tokenImageUri={asset.icon}
        networkImageUri={networkIcon}
      />
      <ListItem.Text primary={asset.symbol} secondary={asset.name} flex={1} />
      <ListItem.Text
        primary={
          <NumberSizeableText
            textAlign="right"
            size="$bodyLgMedium"
            color={
              direction === EDecodedTxDirection.IN ? '$textSuccess' : '$text'
            }
            formatter="balance"
            formatterOptions={{
              tokenSymbol: asset.isNFT ? '' : asset.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${direction === EDecodedTxDirection.IN ? '+' : '-'}${amount}`}
          </NumberSizeableText>
        }
        secondary={
          <NumberSizeableText
            textAlign="right"
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: currencySymbol }}
          >
            {new BigNumber(amount).times(asset.price ?? 0).toString()}
          </NumberSizeableText>
        }
        align="right"
      />
    </ListItem>
  );
}

function HistoryDetails() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.HistoryDetails
      >
    >();

  const { copyText } = useClipboard();

  const { networkId, accountAddress, historyTx } = route.params;

  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const resp = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
          networkId,
          accountAddress,
          txid: historyTx.decodedTx.txid,
          status: historyTx.decodedTx.status,
        }),
        backgroundApiProxy.serviceToken.getNativeToken({ networkId }),
      ]),
    [
      accountAddress,
      historyTx.decodedTx.status,
      historyTx.decodedTx.txid,
      networkId,
    ],
    { watchLoading: true },
  );

  const [network, vaultSettings, txDetailsResp, nativeToken] =
    resp.result ?? [];

  const { data: txDetails, tokens = {}, nfts = {} } = txDetailsResp ?? {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const renderAssetsChange = useCallback(
    ({
      transfers,
      localTransfers,
      direction,
    }: {
      transfers: IOnChainHistoryTxTransfer[] | undefined;
      localTransfers: IDecodedTxTransferInfo[] | undefined;
      direction: EDecodedTxDirection;
    }) => {
      if (transfers) {
        return transfers?.map((transfer, index) => {
          const asset = getOnChainHistoryTxAssetInfo({
            tokenAddress: transfer.token,
            tokens,
            nfts,
          });

          return (
            <AssetItem
              key={index}
              index={index}
              asset={asset}
              direction={direction}
              amount={transfer.amount}
              networkIcon={network?.logoURI ?? ''}
              currencySymbol={settings.currencyInfo.symbol}
            />
          );
        });
      }
      return localTransfers?.map((transfer, index) => {
        const asset = {
          name: transfer.name,
          symbol: transfer.symbol,
          icon: transfer.icon,
          isNFT: transfer.isNFT,
          isNative: transfer.isNative,
          price: '0',
        };

        return (
          <AssetItem
            key={index}
            index={index}
            asset={asset}
            direction={direction}
            amount={transfer.amount}
            networkIcon={network?.logoURI ?? ''}
            currencySymbol={settings.currencyInfo.symbol}
          />
        );
      });
    },
    [network?.logoURI, nfts, settings.currencyInfo.symbol, tokens],
  );

  const renderTxStatus = useCallback(() => {
    const { key, color } = getTxStatusTextProps(historyTx.decodedTx.status);
    return (
      <XStack h="$5" alignItems="center">
        <SizableText size="$bodyMdMedium" color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {historyTx.decodedTx.status === EDecodedTxStatus.Pending ? (
          <XStack ml="$5">
            <Button size="small" variant="primary">
              Speed Up
            </Button>
            <Button size="small" variant="secondary" ml="$2.5">
              Cancel
            </Button>
          </XStack>
        ) : null}
      </XStack>
    );
  }, [historyTx.decodedTx.status, intl]);

  const renderTxId = useCallback(
    (txid: string) => (
      <YStack space="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {txid}
        </SizableText>
        <XStack space="$2">
          <IconButton
            icon="Copy2Outline"
            size="small"
            onPress={() => copyText(txid)}
          />
          <IconButton
            icon="OpenOutline"
            size="small"
            onPress={() =>
              openUrl(
                buildTransactionDetailsUrl({
                  network,
                  txid,
                }),
              )
            }
          />
        </XStack>
      </YStack>
    ),
    [copyText, network],
  );

  const transfersToRender = useMemo(() => {
    let transfers: {
      transfers?: IOnChainHistoryTxTransfer[];
      localTransfers?: IDecodedTxTransferInfo[];
      direction: EDecodedTxDirection;
    }[] = [];

    let sends = txDetails?.sends;
    let receives = txDetails?.receives;
    const localSends = historyTx.decodedTx.actions[0].assetTransfer?.sends;
    const localReceives =
      historyTx.decodedTx.actions[0].assetTransfer?.receives;

    if (vaultSettings?.isUtxo) {
      sends = sends?.filter((send) => send.isOwn);
      receives = receives?.filter((receive) => receive.isOwn);
    }
    transfers = [
      {
        transfers: sends,
        localTransfers: localSends,
        direction: EDecodedTxDirection.OUT,
      },
      {
        transfers: receives,
        localTransfers: localReceives,
        direction: EDecodedTxDirection.IN,
      },
    ];

    return transfers.filter(Boolean);
  }, [
    historyTx.decodedTx.actions,
    txDetails?.receives,
    txDetails?.sends,
    vaultSettings?.isUtxo,
  ]);

  const txAddresses = useMemo(() => {
    if (!txDetails) {
      const { decodedTx } = historyTx;
      if (vaultSettings?.isUtxo) {
        return {
          from: historyTx.decodedTx.signer,
          to: historyTx.decodedTx.actions[0].assetTransfer?.sends
            .map((send) => send.to)
            .join('/n'),
        };
      }

      return {
        from: decodedTx.signer,
        to: decodedTx.to,
      };
    }

    if (vaultSettings?.isUtxo) {
      return {
        from:
          txDetails.sends.length > 1
            ? `${txDetails.sends.length} addresses`
            : txDetails.sends[0].from,

        to:
          txDetails.receives.length > 1
            ? `${txDetails.receives.length} addresses`
            : txDetails.receives[0].to,
      };
    }

    return {
      from: txDetails?.from,
      to: txDetails?.to,
    };
  }, [historyTx, txDetails, vaultSettings?.isUtxo]);

  const txInfo = getHistoryTxDetailInfo({
    txDetails,
    historyTx,
  });

  const renderFeeInfo = useCallback(
    () => (
      <XStack alignItems="center">
        <NumberSizeableText
          formatter="balance"
          size="$bodyMd"
          color="$textSubdued"
          formatterOptions={{
            tokenSymbol: nativeToken?.symbol,
          }}
        >
          {txInfo?.gasFee}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          (
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {txInfo?.gasFeeFiatValue}
          </NumberSizeableText>
          )
        </SizableText>
      </XStack>
    ),
    [
      nativeToken?.symbol,
      settings.currencyInfo.symbol,
      txInfo?.gasFee,
      txInfo?.gasFeeFiatValue,
    ],
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
      <>
        {/* Part 1: What change */}
        <Stack>
          {transfersToRender.map((block) =>
            renderAssetsChange({
              localTransfers: block.localTransfers,
              transfers: block.transfers,
              direction: block.direction,
            }),
          )}
        </Stack>

        {/* Part 2: Details */}
        <Stack>
          {/* Primary */}
          <InfoItemGroup>
            <InfoItem label="Status" renderContent={renderTxStatus()} compact />
            <InfoItem label="Date" renderContent={txInfo.date} compact />
          </InfoItemGroup>
          {/* Secondary */}
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem label="From" renderContent={txAddresses.from} />
            <InfoItem label="To" renderContent={txAddresses.to} />
            <InfoItem
              label="Transaction ID"
              renderContent={renderTxId(txInfo.txid)}
            />
            <InfoItem
              label="Network Fee"
              renderContent={renderFeeInfo()}
              compact
            />
            {vaultSettings?.nonceRequired && !isNil(txInfo.nonce) ? (
              <InfoItem
                label="Nonce"
                renderContent={String(txInfo.nonce)}
                compact
              />
            ) : null}
            {!isNil(txInfo.confirmations) ? (
              <InfoItem
                label="Confirmations"
                renderContent={String(txInfo.confirmations)}
                compact
              />
            ) : null}
          </InfoItemGroup>
          {/* Tertiary */}
          {txInfo.swapInfo ? (
            <>
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
                      <Image
                        src="https://cdn.1inch.io/logo.png"
                        w="$5"
                        h="$5"
                      />
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pl="$1.5"
                      >
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
            </>
          ) : null}
        </Stack>
      </>
    );
  }, [
    renderAssetsChange,
    renderFeeInfo,
    renderTxId,
    renderTxStatus,
    resp.isLoading,
    transfersToRender,
    txAddresses.from,
    txAddresses.to,
    txInfo.confirmations,
    txInfo.date,
    txInfo.nonce,
    txInfo.swapInfo,
    txInfo.txid,
    vaultSettings?.nonceRequired,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={txDetails?.label} />
      <Page.Body>{renderHistoryDetails()}</Page.Body>
    </Page>
  );
}

export { HistoryDetails };
